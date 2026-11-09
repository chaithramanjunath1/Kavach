'use strict';
/*
 * Forensics — honest, explainable, on-device signals. NOT a deepfake detector.
 *  • EXIF reader: finds hidden GPS / device / date data before a photo is shared.
 *  • Error Level Analysis (ELA): shows uneven JPEG compression, one weak hint that a region may have been edited.
 *  • Privacy cleaner: re-encodes a photo, dropping all metadata.
 */
const Forensics = (() => {
  function parseExif(buf) {
    try {
      const v = new DataView(buf);
      if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return { format: 'not-jpeg', found: false };
      let off = 2;
      while (off + 4 < v.byteLength) {
        const marker = v.getUint16(off); off += 2;
        if (marker === 0xFFDA || (marker & 0xFF00) !== 0xFF00) break;
        const len = v.getUint16(off);
        if (marker === 0xFFE1 && v.getUint32(off + 2) === 0x45786966) return readTiff(v, off + 8);
        off += len;
      }
      return { format: 'jpeg', found: false };
    } catch { return { format: 'jpeg', found: false, error: true }; }
  }

  function readTiff(v, t) {
    const le = v.getUint16(t) === 0x4949;
    const u16 = o => v.getUint16(o, le), u32 = o => v.getUint32(o, le);
    const out = { format: 'jpeg', found: true, gps: null };
    const size = e => ({ 2: 1, 3: 2, 4: 4, 5: 8 }[e.type] || 1) * e.count;
    const at = e => size(e) > 4 ? t + u32(e.vo) : e.vo;
    const str = e => { const o = at(e); let s = ''; for (let i = 0; i < e.count - 1; i++) { const c = v.getUint8(o + i); if (!c) break; s += String.fromCharCode(c); } return s.trim(); };
    const rat = o => { const d = u32(o + 4); return d ? u32(o) / d : 0; };
    const entries = ifd => { const n = u16(ifd), a = []; for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (e + 12 > v.byteLength) break; a.push({ tag: u16(e), type: u16(e + 2), count: u32(e + 4), vo: e + 8 }); } return a; };
    let gpsPtr = 0;
    for (const e of entries(t + u32(t + 4))) {
      if (e.tag === 0x010F) out.make = str(e);
      else if (e.tag === 0x0110) out.model = str(e);
      else if (e.tag === 0x0131) out.software = str(e);
      else if (e.tag === 0x0132) out.date = str(e);
      else if (e.tag === 0x8825) gpsPtr = u32(e.vo);
    }
    if (gpsPtr) {
      const g = {};
      for (const e of entries(t + gpsPtr)) {
        const o = at(e);
        if (e.tag === 1) g.latRef = String.fromCharCode(v.getUint8(e.vo));
        else if (e.tag === 3) g.lonRef = String.fromCharCode(v.getUint8(e.vo));
        else if (e.tag === 2) g.lat = rat(o) + rat(o + 8) / 60 + rat(o + 16) / 3600;
        else if (e.tag === 4) g.lon = rat(o) + rat(o + 8) / 60 + rat(o + 16) / 3600;
      }
      if (g.lat != null && g.lon != null) out.gps = { lat: (g.latRef === 'S' ? -1 : 1) * g.lat, lon: (g.lonRef === 'W' ? -1 : 1) * g.lon };
    }
    return out;
  }

  /** Error Level Analysis: recompress at 90% and amplify the difference. */
  async function ela(img, quality = 0.9, scale = 18) {
    const sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
    const r = Math.min(1, 900 / Math.max(sw, sh));
    const w = Math.max(8, Math.round(sw * r)), h = Math.max(8, Math.round(sh * r));
    const c = canvasEl(w, h), x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, w, h);
    const a = x.getImageData(0, 0, w, h);
    const re = await createImageBitmap(await canvasBlob(c, 'image/jpeg', quality));
    const c2 = canvasEl(w, h), x2 = c2.getContext('2d', { willReadFrequently: true });
    x2.drawImage(re, 0, 0);
    const b = x2.getImageData(0, 0, w, h);

    const out = x.createImageData(w, h), cell = 24, gx = Math.ceil(w / cell), gy = Math.ceil(h / cell);
    const sums = new Float64Array(gx * gy), cnt = new Float64Array(gx * gy);
    for (let i = 0; i < a.data.length; i += 4) {
      const d = (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3;
      const vv = Math.min(255, d * scale);
      out.data[i] = out.data[i + 1] = out.data[i + 2] = vv; out.data[i + 3] = 255;
      const p = i / 4, cx = Math.floor((p % w) / cell), cy = Math.floor(Math.floor(p / w) / cell);
      sums[cy * gx + cx] += d; cnt[cy * gx + cx]++;
    }
    const means = [...sums].map((s, i) => cnt[i] ? s / cnt[i] : 0);
    const mu = means.reduce((p, q) => p + q, 0) / means.length || 0.0001;
    const sd = Math.sqrt(means.reduce((p, q) => p + (q - mu) ** 2, 0) / means.length);
    const cv = sd / (mu || 0.0001);
    const outliers = means.filter(m => m > mu + 2 * sd).length / means.length;
    const level = cv > 1.1 || outliers > 0.06 ? 'high' : cv > 0.65 || outliers > 0.03 ? 'medium' : 'low';
    const res = canvasEl(w, h); res.getContext('2d').putImageData(out, 0, 0);
    return { canvas: res, cv: +cv.toFixed(2), outliers: +(outliers * 100).toFixed(1), level };
  }

  /** Re-encode through a canvas: drops EXIF/GPS/device info entirely. */
  async function clean(img, maxSide = 4096, quality = 0.92) {
    const sw = img.naturalWidth || img.width, sh = img.naturalHeight || img.height;
    const r = Math.min(1, maxSide / Math.max(sw, sh));
    const c = canvasEl(Math.round(sw * r), Math.round(sh * r));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return canvasBlob(c, 'image/jpeg', quality);
  }

  return { parseExif, ela, clean };
})();
