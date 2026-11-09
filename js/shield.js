'use strict';
/*
 * Image Shield — a perceptual-hash (pHash, DCT based) fingerprint computed ON THE DEVICE.
 * Only the 64-bit fingerprint is kept; the photo itself is never stored or uploaded.
 * A platform that holds the fingerprint can block re-uploads, even resized, recompressed,
 * brightened, cropped or mirrored copies. This is the same principle as StopNCII.org (which
 * uses its own hashes and real platform partnerships). Here it is demonstrated end-to-end
 * with a clearly-labelled mock platform.
 */
const Shield = (() => {
  const N = 32, K = 8;
  const COS = Array.from({ length: K }, (_, u) => Float64Array.from({ length: N }, (_, x) => Math.cos((2 * x + 1) * u * Math.PI / (2 * N))));
  const POP = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

  function gray(src, mirror) {
    // two-step downscale (to 128 then 32) avoids aliasing on large photos
    const mid = canvasEl(128, 128), mx = mid.getContext('2d'); mx.imageSmoothingQuality = 'high'; mx.drawImage(src, 0, 0, 128, 128);
    const c = canvasEl(N, N), x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high';
    if (mirror) { x.translate(N, 0); x.scale(-1, 1); }
    x.drawImage(mid, 0, 0, N, N);
    const d = x.getImageData(0, 0, N, N).data, g = new Float64Array(N * N);
    for (let i = 0; i < N * N; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    return g;
  }

  function phash(g) {
    const co = [];
    for (let v = 0; v < K; v++) for (let u = 0; u < K; u++) {
      let s = 0;
      for (let y = 0; y < N; y++) { const cy = COS[v][y]; for (let x = 0; x < N; x++) s += g[y * N + x] * COS[u][x] * cy; }
      co.push(s);
    }
    const sorted = co.slice(1).sort((a, b) => a - b), med = sorted[31];
    const bits = co.map(c => c > med ? 1 : 0);
    let h = ''; for (let i = 0; i < 64; i += 4) h += (bits[i] * 8 + bits[i + 1] * 4 + bits[i + 2] * 2 + bits[i + 3]).toString(16);
    return h;
  }

  const hamming = (a, b) => { let d = 0; for (let i = 0; i < 16; i++) d += POP[parseInt(a[i], 16) ^ parseInt(b[i], 16)]; return d; };
  const fingerprint = src => ({ h: phash(gray(src, false)), m: phash(gray(src, true)) }); // original + mirrored
  const bitsOf = h => [...h].flatMap(ch => { const n = parseInt(ch, 16); return [n >> 3 & 1, n >> 2 & 1, n >> 1 & 1, n & 1]; });
  const grid = h => `<div class="bits" aria-label="fingerprint">${bitsOf(h).map(b => `<i class="${b ? 'on' : ''}"></i>`).join('')}</div>`;

  const BLOCK = 10, REVIEW = 16;
  function match(fp, registry) {
    let best = { dist: 64, entry: null };
    for (const e of registry) for (const ref of [e.h, e.m]) {
      const d = hamming(fp.h, ref);
      if (d < best.dist) best = { dist: d, entry: e };
    }
    const verdict = best.dist <= BLOCK ? 'block' : best.dist <= REVIEW ? 'review' : 'allow';
    return { ...best, verdict };
  }

  /* -------- synthetic sample photo (so judges never need to upload a personal image) -------- */
  function sample(seed = 1) {
    const c = canvasEl(640, 800), x = c.getContext('2d');
    let s = seed * 9301 + 49297; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const sky = x.createLinearGradient(0, 0, 0, 800);
    sky.addColorStop(0, seed === 2 ? '#1E3A5F' : '#2A1235'); sky.addColorStop(.55, seed === 2 ? '#3E8E7E' : '#E4572E'); sky.addColorStop(1, '#F2A33A');
    x.fillStyle = sky; x.fillRect(0, 0, 640, 800);
    x.fillStyle = '#FFE9C7'; x.beginPath(); x.arc(150 + seed * 60, 230, 74, 0, 7); x.fill();
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${.2 + rnd() * .5})`; x.fillRect(rnd() * 640, rnd() * 300, 2, 2); }
    [['#7A2A55', 520], ['#5A1F4B', 600], ['#2A1235', 690]].forEach(([col, base], k) => {
      x.fillStyle = col; x.beginPath(); x.moveTo(0, 800);
      for (let px = 0; px <= 640; px += 40) x.lineTo(px, base - Math.sin(px / 90 + k * 2 + seed) * 46 - rnd() * 14);
      x.lineTo(640, 800); x.fill();
    });
    // abstract figure silhouette with a dupatta
    x.fillStyle = '#1B0B22'; x.beginPath(); x.arc(400, 430, 38, 0, 7); x.fill();
    x.beginPath(); x.moveTo(330, 700); x.bezierCurveTo(330, 560, 370, 490, 400, 490); x.bezierCurveTo(430, 490, 470, 560, 470, 700); x.fill();
    x.strokeStyle = '#F2A33A'; x.lineWidth = 12; x.lineCap = 'round'; x.beginPath(); x.moveTo(372, 500); x.bezierCurveTo(300, 560, 280, 620, 300, 700); x.stroke();
    return c;
  }

  /* -------- the edits an abuser might make to dodge a filter -------- */
  async function variants(src) {
    const W = 512, ratio = (src.naturalWidth || src.width) / (src.naturalHeight || src.height);
    const w = ratio >= 1 ? W : Math.round(W * ratio), h = ratio >= 1 ? Math.round(W / ratio) : W;
    const base = canvasEl(w, h); base.getContext('2d').drawImage(src, 0, 0, w, h);
    const make = fn => { const c = canvasEl(w, h), x = c.getContext('2d', { willReadFrequently: true }); fn(x, c); return c; };
    const px = (x, f) => { const d = x.getImageData(0, 0, w, h); for (let i = 0; i < d.data.length; i += 4) { const [r, g, b] = f(d.data[i], d.data[i + 1], d.data[i + 2], i / 4); d.data[i] = r; d.data[i + 1] = g; d.data[i + 2] = b; } x.putImageData(d, 0, 0); };
    const clamp = v => Math.max(0, Math.min(255, v));
    const out = [];
    out.push({ label: 'Resized 35%', canvas: make((x, c) => { const t = canvasEl(Math.round(w * .35), Math.round(h * .35)); t.getContext('2d').drawImage(base, 0, 0, t.width, t.height); x.drawImage(t, 0, 0, w, h); }) });
    out.push({ label: 'Brighter + contrast', canvas: make(x => { x.drawImage(base, 0, 0); px(x, (r, g, b) => [clamp((r - 128) * 1.2 + 128 + 28), clamp((g - 128) * 1.2 + 128 + 28), clamp((b - 128) * 1.2 + 128 + 28)]); }) });
    const jb = await canvasBlob(base, 'image/jpeg', 0.25), jm = await createImageBitmap(jb);
    out.push({ label: 'JPEG quality 25%', canvas: make(x => x.drawImage(jm, 0, 0)) });
    out.push({ label: 'Cropped 8% edges', canvas: make(x => x.drawImage(base, w * .08, h * .08, w * .84, h * .84, 0, 0, w, h)) });
    out.push({ label: 'Mirrored', canvas: make(x => { x.translate(w, 0); x.scale(-1, 1); x.drawImage(base, 0, 0); }) });
    out.push({ label: 'Watermark added', canvas: make(x => { x.drawImage(base, 0, 0); x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, h - 56, w, 56); x.fillStyle = '#fff'; x.font = '700 28px sans-serif'; x.fillText('@throwaway_acct', 18, h - 18); }) });
    out.push({ label: 'Black & white', canvas: make(x => { x.drawImage(base, 0, 0); px(x, (r, g, b) => { const l = .3 * r + .59 * g + .11 * b; return [l, l, l]; }); }) });
    out.push({ label: 'Different photo (control)', canvas: (() => { const s = sample(2), c = canvasEl(w, h); c.getContext('2d').drawImage(s, 0, 0, w, h); return c; })() });
    return out;
  }

  const state = { source: null, registry: [] };
  return { fingerprint, match, hamming, grid, bitsOf, sample, variants, state, BLOCK, REVIEW };
})();

if (typeof module !== 'undefined') module.exports = { hamming: (...a) => Shield.hamming(...a) };

/* ============================== VIEW ============================== */
(function () {
  let tab = 'protect';

  Router.register('shield', async root => {
    const photos = Store.isOpen() ? (await Store.all('shield')).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
    Shield.state.registry = photos;
    const tabs = [['protect', 'Protect a photo'], ['test', 'Test the shield'], ['check', 'Check a photo'], ['clean', 'Privacy cleaner']];
    root.innerHTML = `<div class="page">
      <div class="page-head"><div class="eyebrow">${icon('shield')} Image Shield</div>
        <h1>Protect a photo before it can be misused.</h1>
        <p class="lead">Kavach turns a photo into a tiny fingerprint on <b>your device</b>. The photo never leaves your phone, but a platform holding the fingerprint can recognise and block copies, even edited ones.</p></div>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-tab="${k}" role="tab">${l}</button>`).join('')}</div>
      <div id="shield-body"></div></div>`;
    $$('.tab', root).forEach(b => b.onclick = () => { tab = b.dataset.tab; Router.render(); });
    const body = $('#shield-body');
    ({ protect: protectTab, test: testTab, check: checkTab, clean: cleanTab })[tab](body, photos);
  });

  function dropzone(id, label) {
    return `<label class="drop" id="${id}-drop" for="${id}"><span>${icon('upload')}</span><b>${label}</b><span class="hint">Processed on your device only</span>
      <input type="file" id="${id}" accept="image/*" hidden></label>`;
  }
  function wireDrop(id, cb) {
    const input = $('#' + id), zone = $('#' + id + '-drop');
    input.onchange = () => input.files[0] && cb(input.files[0]);
    ['dragover', 'dragenter'].forEach(e => zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(e => zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.remove('over'); }));
    zone.addEventListener('drop', ev => ev.dataTransfer.files[0] && cb(ev.dataTransfer.files[0]));
  }

  /* ---------- tab 1: protect ---------- */
  function protectTab(body, photos) {
    if (!Store.isOpen()) { body.innerHTML = `<div class="card warn">Unlock Kavach to save fingerprints.</div>`; return; }
    body.innerHTML = `<div class="split"><div class="stack">
        <div class="card"><div class="card-title"><span class="ic coral">${icon('camera')}</span>Choose a photo to protect</div>
          ${dropzone('pf', 'Drop a photo or tap to choose')}
          <div class="row" style="margin-top:12px"><button class="btn sm" id="use-sample">${icon('flask')} Use a sample photo</button><span class="hint">A synthetic image, so you can try without a personal photo.</span></div>
          <div id="pf-result" style="margin-top:16px"></div></div>
        <div class="card tint"><div class="card-title"><span class="ic safe">${icon('lock')}</span>What exactly is stored?</div>
          <ul class="promise"><li>${icon('check')}A 64-bit fingerprint (16 hex characters) and a label you choose.</li>
          <li>${icon('check')}A second fingerprint of the mirrored image, so flipped copies are caught too.</li>
          <li>${icon('check')}<span><b>Not</b> stored: the photo, its name, its location data.</span></li></ul>
          <p class="hint">Real cross-platform blocking needs a registry that platforms trust. <a href="https://stopncii.org" target="_blank" rel="noopener">StopNCII.org</a> does this for intimate images; Kavach’s roadmap is to submit hashes there on your behalf, with your consent.</p></div></div>
      <div class="card" id="plist-card"></div></div>`;

    const drawList = list => {
      $('#plist-card').innerHTML = `<div class="card-title"><span class="ic">${icon('shield')}</span>My protected photos <span class="chip">${list.length}</span></div>
        <div class="stack" id="plist">${list.length ? list.map(p => `<div class="entry"><div class="row" style="gap:14px;align-items:flex-start">${Shield.grid(p.h)}
          <div style="min-width:0;flex:1"><b>${esc(p.label)}</b><div class="hint">${fmt(p.createdAt)}</div><div class="mono">${p.h}</div></div>
          <button class="btn sm ghost" data-del="${p.id}" aria-label="Remove">${icon('trash')}</button></div></div>`).join('') : `<p class="muted">No photos protected yet. Add one on the left, then try to “upload” an edited copy in <b>Test the shield</b>.</p>`}</div>`;
      $$('[data-del]', body).forEach(b => b.onclick = async () => { await Store.del('shield', b.dataset.del); drawList((await Store.all('shield')).sort((a, c) => c.createdAt.localeCompare(a.createdAt))); });
    };
    drawList(photos);

    const handle = async (src, label) => {
      const fp = Shield.fingerprint(src);
      const rec = { id: uid(), label: label || 'Protected photo', h: fp.h, m: fp.m, createdAt: new Date().toISOString() };
      await Store.put('shield', rec.id, rec);
      Shield.state.source = src;
      drawList((await Store.all('shield')).sort((a, c) => c.createdAt.localeCompare(a.createdAt)));
      $('#pf-result').innerHTML = `<div class="verdict allow">${icon('check')}<div>Fingerprint saved on this device. The photo was not uploaded or stored.</div></div>
        <div class="row" style="margin-top:12px;gap:16px">${Shield.grid(rec.h)}<div><b>${esc(rec.label)}</b><div class="mono">${rec.h}</div><div class="hint">Each square is one bit of the fingerprint.</div></div></div>
        <button class="btn primary" style="margin-top:14px" id="go-test">Now try to defeat it →</button>`;
      $('#go-test').onclick = () => { tab = 'test'; Router.render(); };
      toast('Photo protected');
    };
    wireDrop('pf', async f => { const { img } = await loadImage(f); handle(img, f.name.replace(/\.[^.]+$/, '').slice(0, 40)); });
    $('#use-sample').onclick = () => handle(Shield.sample(1), 'Sample photo');
  }

  /* ---------- tab 2: platform simulator ---------- */
  async function testTab(body, photos) {
    body.innerHTML = `<div class="split">
      <div class="stack"><div class="card"><div class="card-title"><span class="ic coral">${icon('flask')}</span>Simulate an abuser re-uploading</div>
        <p class="muted">Pick an edited copy of your protected photo, or upload any image. The mock platform on the right compares it with the fingerprint registry <b>before</b> publishing.</p>
        <div class="pipe"><span class="p">1 Upload</span><span class="ar">→</span><span class="p">2 Fingerprint</span><span class="ar">→</span><span class="p">3 Compare (${photos.length} on file)</span><span class="ar">→</span><span class="p">4 Allow / Block</span></div>
        ${photos.length ? '' : `<div class="card warn" style="margin:10px 0">No protected photos yet. <a href="#/shield" id="back-p">Protect one first</a>, or load the sample below.</div>`}
        <div class="row" style="margin-bottom:12px"><button class="btn sm" id="gen">${icon('tool')} Generate attacker edits</button>
          <button class="btn sm" id="qs">${icon('flask')} Protect sample &amp; generate</button></div>
        <div class="thumbs" id="vars"></div>
        <div style="margin-top:14px">${dropzone('tf', 'Or upload any image to test')}</div></div></div>
      <div class="mock"><div class="mock-top">${icon('users')} MockGram <span class="chip" style="background:rgba(255,255,255,.2);color:#fff;margin-left:auto">simulation</span></div>
        <div class="mock-body"><div class="small muted">New post · registry: <b>${photos.length}</b> protected fingerprint(s)</div>
          <div id="mock-preview" class="center muted" style="padding:28px 0;border:1.5px dashed var(--line);border-radius:12px">Nothing selected</div>
          <div id="mock-verdict"></div>
          <div class="hint">Illustrative only: not a real platform. In production the platform runs this check on the server, with the fingerprint you consented to share.</div></div></div></div>`;

    const attempt = async (src, label) => {
      const reg = (await Store.all('shield'));
      const fp = Shield.fingerprint(src);
      const m = Shield.match(fp, reg);
      const pv = canvasEl(240, 240); const ctx = pv.getContext('2d'); const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height;
      const s = Math.min(sw, sh); ctx.drawImage(src, (sw - s) / 2, (sh - s) / 2, s, s, 0, 0, 240, 240);
      $('#mock-preview').innerHTML = ''; $('#mock-preview').style.padding = '0'; $('#mock-preview').appendChild(pv); pv.style.cssText = 'width:100%;border-radius:12px;display:block';
      const cfg = {
        block: ['block', 'alert', `Blocked. This image matches a protected photo (${m.dist}/64 bits differ). It was never published.`],
        review: ['review', 'eye', `Held for human review. Similar to a protected photo (${m.dist}/64 bits differ).`],
        allow: ['allow', 'check', reg.length ? `Allowed. No close match (nearest differs by ${m.dist}/64 bits).` : 'Allowed. The registry is empty.'],
      }[m.verdict];
      $('#mock-verdict').innerHTML = `<div class="verdict ${cfg[0]}">${icon(cfg[1])}<div>${cfg[2]}<div class="small" style="font-weight:500">${esc(label)} · block ≤ ${Shield.BLOCK}, review ≤ ${Shield.REVIEW}</div></div></div>`;
      $('#mock-verdict').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };

    const gen = async src => {
      const vs = await Shield.variants(src);
      const host = $('#vars'); host.innerHTML = '';
      vs.forEach(v => {
        const d = document.createElement('button'); d.className = 'variant'; d.type = 'button';
        d.appendChild(v.canvas); d.appendChild(document.createTextNode(v.label));
        d.onclick = () => attempt(v.canvas, v.label); host.appendChild(d);
      });
    };
    $('#gen').onclick = () => { const src = Shield.state.source || (photos.length ? Shield.sample(1) : null); if (!src) return toast('Protect a photo first', 'warn'); gen(src); };
    $('#qs').onclick = async () => {
      const src = Shield.sample(1), fp = Shield.fingerprint(src), rec = { id: uid(), label: 'Sample photo', h: fp.h, m: fp.m, createdAt: new Date().toISOString() };
      await Store.put('shield', rec.id, rec); Shield.state.source = src; toast('Sample protected'); await gen(src);
    };
    wireDrop('tf', async f => { const { img } = await loadImage(f); attempt(img, f.name); });
  }

  /* ---------- tab 3: forensics ---------- */
  function checkTab(body) {
    body.innerHTML = `<div class="split"><div class="stack">
      <div class="card"><div class="card-title"><span class="ic gold">${icon('search')}</span>Check a suspicious photo</div>
        <p class="muted">Look for hints that an image was edited, and see what hidden data it carries. This runs entirely on your device.</p>
        ${dropzone('cf', 'Drop the photo you want to examine')}
        <div class="card warn" style="margin-top:14px"><b>Assistive, not proof.</b> Modern AI fakes can pass these checks, and honest photos can fail them. Use this to decide what to preserve and report, then ask the cybercrime cell for a formal forensic examination.</div></div></div>
      <div id="cf-out" class="stack"><div class="card muted center">Results will appear here.</div></div></div>`;
    wireDrop('cf', async f => {
      const buf = await f.arrayBuffer(), { img } = await loadImage(f);
      const ex = Forensics.parseExif(buf), el = await Forensics.ela(img);
      const lvl = { low: ['safe', 'No strong inconsistency'], medium: ['warn', 'Some inconsistency'], high: ['danger', 'Notable inconsistency'] }[el.level];
      const out = $('#cf-out');
      out.innerHTML = `<div class="card"><div class="card-title">Error Level Analysis <span class="chip ${lvl[0]}">${lvl[1]}</span></div>
          <div class="grid g2"><div><div class="lbl small">Original</div><img class="thumb" src="${URL.createObjectURL(f)}" alt="original" style="aspect-ratio:auto"></div>
          <div><div class="lbl small">ELA (brighter = recompressed differently)</div><div id="ela-host"></div></div></div>
          <p class="hint" style="margin-top:10px">Compression variation score ${el.cv} · ${el.outliers}% of regions are outliers. Edited or pasted regions often compress differently from the rest, but screenshots, filters and resaves also do.</p></div>
        <div class="card"><div class="card-title">Hidden data (EXIF)</div>${exifHtml(ex, f)}</div>`;
      el.canvas.style.cssText = 'width:100%;border-radius:12px;display:block'; $('#ela-host').appendChild(el.canvas);
    });
  }
  function exifHtml(ex, f) {
    if (!ex.found) return `<p class="muted">${ex.format === 'not-jpeg' ? 'Not a JPEG, so no EXIF block to read (PNGs and screenshots usually carry none).' : 'No EXIF data found. Nothing hidden to leak.'}</p>`;
    return `<dl class="kv"><dt>Device</dt><dd>${esc([ex.make, ex.model].filter(Boolean).join(' ') || 'not recorded')}</dd><dt>Software</dt><dd>${esc(ex.software || 'not recorded')}</dd><dt>Date taken</dt><dd>${esc(ex.date || 'not recorded')}</dd>
      <dt>GPS</dt><dd>${ex.gps ? `<span class="chip danger">Location embedded</span> ${ex.gps.lat.toFixed(5)}, ${ex.gps.lon.toFixed(5)}` : '<span class="chip safe">No location</span>'}</dd></dl>
      ${ex.gps ? '<p class="small" style="margin-top:10px"><b>Anyone who receives this file can see where it was taken.</b> Use the Privacy cleaner before sharing.</p>' : ''}`;
  }

  /* ---------- tab 4: privacy cleaner ---------- */
  function cleanTab(body) {
    body.innerHTML = `<div class="split"><div class="card"><div class="card-title"><span class="ic safe">${icon('eye')}</span>Strip hidden data before you share</div>
      <p class="muted">Photos can carry the exact GPS location of your home, your phone model and the time. Drop a photo to see what it reveals, then download a clean copy.</p>
      ${dropzone('cl', 'Drop a photo to clean')}</div><div id="cl-out" class="card muted center">Results will appear here.</div></div>`;
    wireDrop('cl', async f => {
      const buf = await f.arrayBuffer(), { img } = await loadImage(f), ex = Forensics.parseExif(buf), blob = await Forensics.clean(img);
      $('#cl-out').className = 'card'; $('#cl-out').innerHTML = `<div class="card-title">What this photo reveals</div>${exifHtml(ex, f)}
        <hr style="border:0;border-top:1px solid var(--line);margin:16px 0"><div class="verdict allow">${icon('check')}<div>Clean copy ready: all metadata removed.<div class="small" style="font-weight:500">${(f.size / 1024).toFixed(0)} KB → ${(blob.size / 1024).toFixed(0)} KB</div></div></div>
        <button class="btn primary" style="margin-top:12px" id="dl-clean">${icon('download')} Download clean copy</button>`;
      $('#dl-clean').onclick = () => download('clean-' + f.name.replace(/\.[^.]+$/, '') + '.jpg', blob);
    });
  }
})();
