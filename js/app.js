'use strict';
/* App shell: onboarding / lock, navigation, quick-exit, disguise mode, and the home / emergency / help / about views. */

const NAV = [
  ['home', 'nav_home', 'home'], ['sos', 'nav_sos', 'alert'], ['shield', 'nav_shield', 'shield'], ['vault', 'nav_vault', 'lock'],
  ['report', 'nav_report', 'file'], ['sahara', 'nav_sahara', 'heart'], ['help', 'nav_help', 'phone'], ['about', 'nav_about', 'info'],
];
const TAB = [['home', 'nav_home', 'home'], ['shield', 'nav_shield', 'shield'], ['vault', 'nav_vault', 'lock'], ['report', 'nav_report', 'file'], ['sahara', 'nav_sahara', 'heart'], ['sos', 'nav_sos', 'alert']];

const App = {
  disguised: (() => { try { return localStorage.getItem('kv_disguise') === '1'; } catch { return false; } })(),

  refresh() { App.drawChrome(); Router.render(); },

  drawChrome() {
    const d = App.disguised;
    document.title = d ? 'Daily Notes' : 'Kavach — Her image. Her evidence. Her call.';
    document.body.classList.toggle('disguise', d);
    $('#side').innerHTML = `<div class="brand"><img src="assets/logo.svg" alt=""><div><b>${d ? 'Daily Notes' : 'Kavach'}</b><small>${d ? 'Your private notebook' : t('brand_sub')}</small></div></div>
      <nav class="nav">${NAV.map(([r, k, ic]) => `<a href="#/${r}" data-r="${r}" class="${r === 'sos' ? 'sos' : ''}">${icon(ic)}<span>${t(k)}</span></a>`).join('')}</nav>
      <div class="side-foot"><div class="lbl small" style="color:#CDB5D6">${t('lang')}</div>
        <div class="seg"><button data-l="en" class="${LANG === 'en' ? 'on' : ''}">English</button><button data-l="hi" class="${LANG === 'hi' ? 'on' : ''}">हिन्दी</button></div>
        <button class="side-btn" id="dis">${icon('eye')} ${d ? 'Show Kavach' : t('disguise')}</button>
        <button class="side-btn" id="lock">${icon('lock')} Lock</button></div>`;
    $('#tabbar').innerHTML = TAB.map(([r, k, ic]) => `<a href="#/${r}" data-r="${r}" class="${r === 'sos' ? 'sos' : ''}">${icon(ic)}<span>${t(k).split(' ')[0]}</span></a>`).join('');
    $('#qexit').innerHTML = `${icon('exit')}<span>${t('quick_exit')}</span>`;
    $$('[data-l]').forEach(b => b.onclick = () => setLang(b.dataset.l));
    $('#dis').onclick = () => { App.disguised = !App.disguised; try { localStorage.setItem('kv_disguise', App.disguised ? '1' : '0'); } catch {} toast(App.disguised ? t('disguise_on') : 'Kavach is visible again'); App.drawChrome(); };
    $('#lock').onclick = () => { Store.lock(); location.hash = '#/home'; App.gate(); };
    App.mark(Router.current);
  },
  mark(r) { $$('.nav a, .tabbar a').forEach(a => { const on = a.dataset.r === r; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); },

  quickExit() {
    Escalation.close && Escalation.close();
    $('#view').innerHTML = ''; $('#overlay').innerHTML = ''; $('#modal').innerHTML = '';
    Store.lock();
    try { sessionStorage.clear(); } catch {}
    location.replace('https://www.google.com/search?q=weather+today');
  },

  async gate() {
    const mode = await Store.init(); const g = $('#gate');
    if (mode === 'open') { g.innerHTML = ''; return; }
    const art = `<div class="gate-art"><div><img src="assets/hero.svg" alt="Three women standing together behind a shield"><div class="tag">${t('tagline')}</div></div></div>`;
    if (mode === 'new') {
      g.innerHTML = `<div class="gate">${art}<div class="gate-form"><div class="eyebrow">Welcome</div><h1>Set up your private space.</h1>
        <p class="lead" style="font-size:1rem">Kavach keeps everything on <b>this device</b>, encrypted. We never see your photos, evidence or messages.</p>
        <ul class="promise"><li>${icon('check')}No account, no email, no tracking.</li><li>${icon('check')}Your photos are fingerprinted here; they are never uploaded.</li><li>${icon('check')}Evidence is encrypted and tamper-evident.</li></ul>
        <form id="gf"><div class="field"><label for="gp">Create a passphrase</label><input type="password" id="gp" autocomplete="new-password" minlength="6" placeholder="At least 6 characters"><span class="hint">Choose something only you would know. <b>We cannot recover it</b> if you forget it.</span></div>
        <button class="btn primary lg block" type="submit">${icon('lock')} Create my vault</button></form>
        <button class="btn block ghost" id="gskip" style="margin-top:10px">Try the demo without a passphrase</button>
        <p class="hint" style="margin-top:10px">Demo mode stores data on this device without a passphrase, so anyone using this browser could open it.</p></div></div>`;
      $('#gf').onsubmit = async e => { e.preventDefault(); const p = $('#gp').value; if (p.length < 6) return toast('Use at least 6 characters', 'warn'); await Store.setupPass(p); g.innerHTML = ''; Router.render(); App.drawChrome(); toast('Your vault is ready'); };
      $('#gskip').onclick = async () => { await Store.setupDevice(); g.innerHTML = ''; Router.render(); App.drawChrome(); };
    } else {
      g.innerHTML = `<div class="gate">${art}<div class="gate-form"><div class="eyebrow">Welcome back</div><h1>Unlock Kavach.</h1>
        <form id="gf"><div class="field"><label for="gp">Passphrase</label><input type="password" id="gp" autocomplete="current-password" autofocus></div>
        <button class="btn primary lg block" type="submit">${icon('lock')} Unlock</button></form>
        <p class="hint" style="margin-top:14px">Forgot it? Your data is encrypted with it and cannot be recovered. You can <button class="btn sm ghost" id="gw">erase everything and start over</button></p>
        <p style="margin-top:14px"><a class="btn danger" href="tel:112">${icon('phone')} Need help now? Call 112</a> <a class="btn" href="tel:14416">Tele-MANAS 14416</a></p></div></div>`;
      $('#gf').onsubmit = async e => { e.preventDefault(); if (await Store.unlock($('#gp').value)) { g.innerHTML = ''; Router.render(); App.drawChrome(); } else { toast('That passphrase did not work', 'warn'); $('#gp').select(); } };
      $('#gw').onclick = async () => { if (confirm('This permanently erases all evidence, photos and settings on this device. Continue?')) { await Store.wipe(); location.reload(); } };
    }
  },
};

/* ------------------------------ views ------------------------------ */
Router.register('home', async root => {
  let ev = 0, ph = 0, cs = 0, ok = true;
  if (Store.isOpen()) { const e = await Vault.list(); ev = e.length; ok = (await Vault.verify(e)).ok; ph = (await Store.all('shield')).length; cs = (await Store.all('cases')).filter(c => !c.resolved).length; }
  const net = Store.isOpen() ? await Net.load() : null;
  const setup = [['Add a trusted person', net && net.circle.length > 0, '#/sahara'], ['Protect your first photo', ph > 0, '#/shield'], ['Save a piece of evidence', ev > 0, '#/vault'], ['Write your safety plan', net && Object.values(net.plan || {}).some(Boolean), '#/sahara']];
  const done = setup.filter(s => s[1]).length;
  root.innerHTML = `<div class="page">
    <section class="hero"><div><div class="tag">${t('tagline')}</div><h1>${t('hero_title')}</h1><p>${t('hero_sub')}</p>
      <div class="row" style="margin-top:22px"><a class="btn coral lg" href="#/sos">${icon('alert')} ${t('cta_sos')}</a><a class="btn lg" href="#/shield">${t('cta_shield')}</a><a class="btn lg ghost" style="color:#fff;border-color:rgba(255,255,255,.5)" href="#/sahara">${t('cta_talk')}</a></div></div>
      <img src="assets/hero.svg" alt="Three women standing together behind a shield"></section>
    <div class="quick">${[['shield', 'a', 'qa_shield', 'shield'], ['lock', 'b', 'qa_vault', 'vault'], ['file', 'c', 'qa_report', 'report'], ['heart', 'd', 'qa_sahara', 'sahara']].map(([ic, c, k, r]) => `<a class="card link" href="#/${r}"><span class="qi ${c}">${icon(ic)}</span><h3>${t(k)}</h3><p>${t(k + '_d')}</p></a>`).join('')}</div>
    <div class="split"><div class="card"><div class="spread"><div class="card-title" style="margin:0">Your protection</div><span class="chip ${done === 4 ? 'safe' : 'warn'}">${done}/4 set up</span></div>
      <div class="progress" style="margin:14px 0"><i style="width:${done / 4 * 100}%"></i></div>
      <div class="stack">${setup.map(([l, d, h]) => `<a class="chk ${d ? 'done' : ''}" href="${h}" style="text-decoration:none;color:inherit"><input type="checkbox" ${d ? 'checked' : ''} tabindex="-1" aria-hidden="true" style="pointer-events:none"><span>${l}</span></a>`).join('')}</div></div>
      <div class="stack"><div class="grid g2"><div class="card"><div class="stat"><b>${ph}</b><span>photos shielded</span></div></div><div class="card"><div class="stat"><b>${ev}</b><span>evidence entries ${ev ? (ok ? '· intact' : '· <span style="color:var(--danger)">BROKEN</span>') : ''}</span></div></div></div>
        <div class="card"><div class="stat"><b>${cs}</b><span>open case${cs === 1 ? '' : 's'}</span></div></div>
        <div class="card dark"><div class="card-title" style="color:#FFD08A">${icon('lock')} ${t('privacy_h')}</div><p class="small" style="margin:0;color:#E9D8EE">Photos are fingerprinted on your device and never uploaded. Evidence is encrypted here. No account, no tracking. Use <b>Quick exit</b> (or press Esc twice) to leave instantly.</p></div></div></div>
    <div class="card tint" style="margin-top:22px"><div class="spread"><div><div class="card-title" style="margin:0">${t('mood_q')}</div><p class="muted small" style="margin:4px 0 0">If it feels like too much, Sahara is here, and so are people who can help.</p></div>
      <div class="row"><a class="btn" href="#/sahara">Talk to Sahara</a><a class="btn safe" href="tel:14416">${icon('phone')} 14416</a></div></div></div></div>`;
});

Router.register('sos', root => {
  root.innerHTML = `<div class="page"><div class="page-head"><div class="eyebrow" style="color:var(--danger)">${icon('alert')} ${t('nav_sos')}</div><h1>${t('sos_title')}</h1><p class="lead">${t('sos_sub')}</p></div>
    <div class="split"><div class="stack"><div class="steps">${[1, 2, 3, 4, 5].map(i => `<div class="step"><div><h3>${t('sos_' + i)}</h3><p>${t('sos_' + i + 'd')}</p></div></div>`).join('')}</div>
      <div class="card"><div class="card-title">${icon('flask')} Words you can use</div><p class="small muted">If someone is blackmailing you, you can reply once, calmly, then stop:</p>
        <div class="letter" style="max-height:none;font-family:inherit;font-size:.92rem">I will not be paying anything. I have saved all of our conversation and filed a complaint with the cyber crime cell. Any further contact or sharing of my images will be added to the case.</div>
        <button class="btn sm" style="margin-top:10px" id="cpy">${icon('copy')} Copy</button></div></div>
      <div class="stack"><div class="hl red"><div><b>112</b><span>Emergency · immediate danger</span></div><a class="btn danger" href="tel:112">${icon('phone')} ${t('call')}</a></div>
        <div class="hl"><div><b>1930</b><span>Cyber crime helpline</span></div><a class="btn coral" href="tel:1930">${icon('phone')} ${t('call')}</a></div>
        <a class="btn block" href="https://cybercrime.gov.in" target="_blank" rel="noopener">${icon('link')} cybercrime.gov.in: file online</a>
        <a class="btn primary block" href="#/vault?new">${icon('lock')} Save evidence now</a><a class="btn block" href="#/report">${icon('file')} Draft my complaint</a><a class="btn block" href="#/sahara">${icon('heart')} I need someone to talk to</a>
        <div class="card safe"><b>Remember:</b> you are the victim. Offenders rely on shame and silence. Telling one trusted person is often the moment things start to change.</div></div></div></div>`;
  $('#cpy').onclick = () => copy($('.letter', root).textContent);
});

Router.register('help', root => {
  const H = [['112', 'Emergency response', 'Police, fire, ambulance. Unified national number.', 'red'], ['1930', 'National Cyber Crime Helpline', 'Report financial fraud, sextortion, online abuse.', ''], ['14416', 'Tele-MANAS', 'Free tele-mental-health, 24x7, in many languages.', ''], ['14490', 'NCW Women Helpline', 'National Commission for Women, 24x7.', ''], ['181', 'Women Helpline', 'Support and referral for women in distress.', ''], ['1098', 'Childline', 'For children in distress.', '']];
  const R = [['Your images cannot be shared without consent', 'Sharing intimate images without consent is an offence (IT Act ss.66E, 67, 67A; BNS ss.77, 78).'], ['You can ask a platform to remove it', 'Under the IT Rules 2021, platforms must remove intimate-image and impersonation content within 24 hours of a complaint from the person affected.'], ['You can file a complaint online', 'The National Cyber Crime Reporting Portal lets you report without going to a station, and offers an option to report anonymously for some categories.'], ['You do not need to be perfect', 'Panic, deleted messages or late reporting do not make you at fault. Report anyway.'], ['Free legal aid exists', 'Women are entitled to free legal services through the National and State Legal Services Authorities. Ask at your District Legal Services Authority (nalsa.gov.in).'], ['One Stop Centres (Sakhi)', 'Government-run centres give women in distress medical, legal and counselling support under one roof.']];
  root.innerHTML = `<div class="page"><div class="page-head"><div class="eyebrow">${icon('phone')} ${t('nav_help')}</div><h1>Help is closer than it feels.</h1><p class="lead">Last checked 8 Nov 2026 against PIB and NCW pages. Please confirm locally, as services change.</p></div>
    <div class="grid g2" style="margin-bottom:24px">${H.map(([n, nm, d, c]) => `<div class="hl ${c}"><div><b>${n}</b><span><b>${nm}</b><br>${d}</span></div><a class="btn ${c ? 'danger' : 'safe'}" href="tel:${n.replace(/[^\d]/g, '')}">${icon('phone')} ${t('call')}</a></div>`).join('')}</div>
    <h2>Your rights, in plain words</h2><div class="grid g2">${R.map(([h, p]) => `<div class="card"><h3>${h}</h3><p class="muted" style="margin:0">${p}</p></div>`).join('')}</div>
    <div class="card warn" style="margin-top:20px"><b>Not legal advice.</b> Kavach is a self-help tool. Laws and procedures change; a lawyer or legal-aid cell can confirm what applies to you.</div></div>`;
});

Router.register('about', root => {
  root.innerHTML = `<div class="page"><div class="page-head"><div class="eyebrow">${icon('info')} About Kavach</div><h1>Built for the moment nobody else is watching.</h1>
    <p class="lead">Online abuse is a problem with five different systems and no front door. Kavach is that front door.</p></div>
    <div class="grid g3">${[['shield', 'Prevent', 'On-device perceptual fingerprints (pHash) let platforms block re-uploads of a protected photo, even edited. Same principle as StopNCII.'], ['lock', 'Prove', 'Hash-chained, encrypted evidence with a BSA s.63 certificate template and one-click court-ready report.'], ['file', 'Act', 'Complaint drafter, 24-hour takedown notices and a case tracker for the cyber cell route.'], ['heart', 'Heal', 'Sahara, with a consent-based safety net that reaches trusted people and 112.'], ['eye', 'Private', 'No server. No account. AES-256-GCM encryption. Quick exit and disguise mode for unsafe homes.'], ['globe', 'Accessible', 'Installable offline PWA, English and Hindi, runs on a basic phone browser.']].map(([i, h, p]) => `<div class="card"><div class="card-title"><span class="ic">${icon(i)}</span>${h}</div><p class="muted" style="margin:0">${p}</p></div>`).join('')}</div>
    <div class="card" style="margin-top:20px"><div class="card-title">What is real, and what is simulated</div>
      <div class="grid g2"><div><span class="chip safe">Real, runs on-device</span><ul><li>Perceptual hashing and matching</li><li>AES-256-GCM encrypted storage, PBKDF2 key derivation</li><li>SHA-256 hash-chained evidence, verification</li><li>EXIF reading, error-level analysis, metadata cleaning</li><li>Complaint / takedown drafting, case deadlines</li><li>Local crisis-language detection, breathing, grounding</li></ul></div>
      <div><span class="chip warn">Simulated or needs partners</span><ul><li>The “MockGram” platform is a demonstration, not a real platform</li><li>Real cross-platform blocking needs a trusted registry (StopNCII) and platform adoption</li><li>Sending SMS / reaching 112 needs a server relay and an ERSS-112 / telecom partnership. A browser alone cannot do it silently</li><li>ELA is a weak hint, not a deepfake detector</li><li>Sahara is rule-based; it is a companion, not a clinician</li></ul></div></div></div>
    <div class="card" style="margin-top:20px"><div class="card-title">Roadmap</div><div class="pipe"><span class="p on">Now · on-device prototype</span><span class="ar">→</span><span class="p">Pilot with a college ICC + NGO</span><span class="ar">→</span><span class="p">StopNCII hash submission</span><span class="ar">→</span><span class="p">Consent-based alert relay + 112 integration</span><span class="ar">→</span><span class="p">Clinician-reviewed Sahara, more Indian languages</span></div></div>
    <div class="card dark" style="margin-top:20px"><div class="spread"><div><b style="font-family:var(--serif);font-size:1.2rem">Demo controls</b><div class="small muted">For judges: toggle simulation mode for alerts, or wipe local data.</div></div>
      <div class="row"><button class="btn sm" id="dm"></button><button class="btn sm danger" id="wipe">Erase all data</button></div></div></div></div>`;
  const dm = $('#dm'), paint = () => dm.textContent = CONFIG.demo ? 'Simulation mode: ON' : 'Simulation mode: OFF';
  paint(); dm.onclick = () => { CONFIG.demo = !CONFIG.demo; paint(); };
  $('#wipe').onclick = async () => { if (confirm('Erase everything stored on this device?')) { await Store.wipe(); location.reload(); } };
});

Router.onChange = r => App.mark(r);

/* ------------------------------ boot ------------------------------ */
let escAt = 0;
document.addEventListener('keydown', e => { if (e.key === 'Escape') { const n = Date.now(); if (n - escAt < 700) App.quickExit(); escAt = n; closeModal(); } });
$('#qexit').addEventListener('click', App.quickExit);

(async function boot() {
  document.documentElement.lang = LANG;
  App.drawChrome();
  await App.gate();
  Router.render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
