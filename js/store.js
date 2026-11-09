'use strict';
/*
 * Store — everything a woman saves in Kavach lives ONLY in this browser's IndexedDB,
 * encrypted with AES-256-GCM.
 *   • "pass" mode  : key derived from her passphrase (PBKDF2-SHA256, 250k iterations). We cannot recover it.
 *   • "device" mode: random key stored beside the data (protects against casual snooping only; demo convenience).
 * Records are { id, iv, ct }. Nothing is ever sent to a server.
 */
const Store = (() => {
  let db, key = null, cfg = null;
  const enc = s => new TextEncoder().encode(s);
  const dec = b => new TextDecoder().decode(b);

  const open = () => new Promise((res, rej) => {
    const r = indexedDB.open('kavach', 1);
    r.onupgradeneeded = () => { ['evidence', 'blobs', 'shield', 'cases', 'kv', 'meta'].forEach(n => r.result.createObjectStore(n, { keyPath: 'id' })); };
    r.onsuccess = () => { db = r.result; res(); };
    r.onerror = () => rej(r.error);
  });
  const store = (s, m = 'readonly') => db.transaction(s, m).objectStore(s);
  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const rawGet = (s, id) => req(store(s).get(id));
  const rawPut = (s, rec) => req(store(s, 'readwrite').put(rec));
  const rawAll = s => req(store(s).getAll());
  const rawDel = (s, id) => req(store(s, 'readwrite').delete(id));

  async function deriveKey(pass, salt) {
    const base = await crypto.subtle.importKey('raw', enc(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(bytes) {
    if (!key) throw new Error('locked');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return { iv, ct: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes) };
  }
  const unseal = rec => { if (!key) throw new Error('locked'); return crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, key, rec.ct); };

  return {
    async init() {
      await open();
      cfg = await rawGet('meta', 'cfg');
      if (!cfg) return 'new';
      if (cfg.mode === 'device') { key = await crypto.subtle.importKey('jwk', cfg.jwk, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); return 'open'; }
      return 'locked';
    },
    async setupPass(pass) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      key = await deriveKey(pass, salt);
      cfg = { id: 'cfg', mode: 'pass', salt, chk: await seal(enc('kavach-ok')) };
      await rawPut('meta', cfg);
    },
    async setupDevice() {
      const k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      const jwk = await crypto.subtle.exportKey('jwk', k);
      key = await crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
      cfg = { id: 'cfg', mode: 'device', jwk };
      await rawPut('meta', cfg);
    },
    async unlock(pass) {
      try {
        const k = await deriveKey(pass, cfg.salt);
        const p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: cfg.chk.iv }, k, cfg.chk.ct);
        if (dec(p) !== 'kavach-ok') return false;
        key = k; return true;
      } catch { return false; }
    },
    lock() { key = null; },
    isOpen: () => !!key,
    mode: () => cfg && cfg.mode,

    async put(s, id, obj) { const { iv, ct } = await seal(enc(JSON.stringify(obj))); await rawPut(s, { id, iv, ct }); return obj; },
    async get(s, id, def = null) { const r = await rawGet(s, id); return r ? JSON.parse(dec(await unseal(r))) : def; },
    async all(s) { const out = []; for (const r of await rawAll(s)) out.push(JSON.parse(dec(await unseal(r)))); return out; },
    del: rawDel,
    async putBlob(id, buf) { const { iv, ct } = await seal(buf); await rawPut('blobs', { id, iv, ct }); },
    async getBlob(id) { const r = await rawGet('blobs', id); return r ? unseal(r) : null; },

    async wipe() {
      key = null; cfg = null;
      db.close();
      await new Promise(res => { const r = indexedDB.deleteDatabase('kavach'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
    },
  };
})();
