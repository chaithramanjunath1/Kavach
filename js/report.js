'use strict';
/*
 * Report & Takedown — turns a frightening situation into a clear plan:
 *  1. Analyze what is happening (rule-based, on-device, explainable).
 *  2. Draft a complaint for cybercrime.gov.in / the cyber cell, with indicative legal provisions.
 *  3. Draft a platform takedown notice citing the 24-hour rule of the IT Rules, 2021.
 *  4. Track every report and follow-up deadline in one place.
 * Legal mappings are INDICATIVE. Police decide the sections; a lawyer should verify.
 */
const Legal = (() => {
  const S = {
    it66C: 'IT Act s.66C (identity theft)', it66D: 'IT Act s.66D (cheating by personation using a computer resource)',
    it66E: 'IT Act s.66E (violation of privacy)', it67: 'IT Act s.67 (publishing obscene material electronically)',
    it67A: 'IT Act s.67A (publishing sexually explicit material electronically)',
    b75: 'BNS s.75 (sexual harassment)', b77: 'BNS s.77 (voyeurism)', b78: 'BNS s.78 (stalking, including electronic monitoring)',
    b79: 'BNS s.79 (word, gesture or act intended to insult the modesty of a woman)', b308: 'BNS s.308 (extortion)',
    b319: 'BNS s.319 (cheating by personation)', b351: 'BNS s.351 (criminal intimidation)', b356: 'BNS s.356 (defamation)',
  };
  const T = {
    sextortion: { label: 'Sextortion / blackmail', secs: ['b308', 'b351', 'it66E', 'it67A', 'b79'], rx: [/blackmail|sextort/i, /(send|pay|transfer|upi|gpay|paytm|bitcoin|crypto|money|₹|rs\.?\s?\d|rupee)/i, /(leak|viral|share|post|expose|send (it )?to (your|all)|tell (your )?(family|parents|husband|friends)|contacts)/i, /(nude|naked|video call|private (photo|video|pic)|intimate|screenshot|recorded|recording)/i, /(or else|otherwise|if you (don'?t|do not)|last chance|within \d+ ?(hour|hrs|min)|by tonight|today only)/i] },
    nci: { label: 'Non-consensual intimate images', secs: ['it66E', 'it67', 'it67A', 'b77', 'b79'], rx: [/(nude|naked|intimate|private (photo|video|pic)|leaked|sex tape|mms)/i, /(posted|uploaded|shared|circulat|viral|telegram group|website)/i] },
    deepfake: { label: 'Morphed image / deepfake', secs: ['it66C', 'it66D', 'it66E', 'it67A', 'b356', 'b79'], rx: [/(morph|deepfake|deep fake|fake (photo|video|image|nude)|edited (photo|picture|my face)|ai[- ]generated|face.?swap)/i] },
    impersonation: { label: 'Impersonation / fake profile', secs: ['it66C', 'it66D', 'b319', 'b356'], rx: [/(fake (account|profile|id)|impersonat|pretending to be me|using my (photos?|pics?|name|number)|cloned)/i] },
    stalking: { label: 'Stalking / persistent harassment', secs: ['b78', 'b79', 'b351'], rx: [/(stalk|following me|keeps? (messaging|calling|texting)|new (accounts?|numbers?)|won'?t stop|tracking|knows where i)/i] },
    threat: { label: 'Threats / intimidation', secs: ['b351', 'b79'], rx: [/(i will (kill|hurt|beat|find|rape|destroy)|going to (kill|hurt|rape)|threat|acid|will not leave you|you will regret)/i] },
    doxxing: { label: 'Doxxing / privacy exposure', secs: ['b78', 'b351', 'it66E'], rx: [/(my (address|phone number|number|workplace|college|location) (was|is|has been)? ?(posted|shared|leaked|public)|doxx|posted my (address|number)|knows my (address|home))/i] },
    harassment: { label: 'Online sexual harassment / abuse', secs: ['b75', 'b79', 'b351'], rx: [/(obscene|vulgar|dirty (message|text)|sexual (message|comment|remark)|dick pic|unsolicited|abus(e|ive)|slut|whore|rate you|sexually)/i] },
  };

  function analyze(text) {
    const found = [];
    for (const [key, def] of Object.entries(T)) {
      const cues = []; let score = 0;
      def.rx.forEach(rx => { const m = text.match(rx); if (m) { score++; cues.push(m[0]); } });
      const need = (key === 'sextortion' || key === 'nci') ? 2 : 1;
      if (score >= need) found.push({ key, label: def.label, score, cues, secs: def.secs.map(s => S[s]) });
    }
    found.sort((a, b) => b.score - a.score);
    const money = /(pay|transfer|upi|bitcoin|money|₹|rs\.?\s?\d)/i.test(text), deadline = /(tonight|today|within \d+|hours?|last chance|deadline)/i.test(text);
    const sx = found.find(f => f.key === 'sextortion');
    let urgency = 'medium';
    if (found.some(f => ['threat', 'sextortion', 'nci'].includes(f.key))) urgency = 'high';
    if ((sx && money && deadline) || (found.some(f => f.key === 'threat') && /(kill|acid|rape)/i.test(text))) urgency = 'critical';
    return { found, urgency };
  }
  const labelOf = k => (T[k] || {}).label || k;
  const sectionsFor = k => ((T[k] || {}).secs || []).map(s => S[s]);

  function buildComplaint(f) {
    const secs = sectionsFor(f.type);
    const ann = (f.evidence || []).map((e, i) => `   ${i + 1}. ${e.platform}${e.handle ? ' / ' + e.handle : ''}, recorded ${e.createdAt}. ${e.files.map(x => `${x.name} (SHA-256 ${x.sha256})`).join('; ') || 'no attachment'}`).join('\n');
    return `To,
The Officer-in-Charge,
Cyber Crime Cell / Police Station${f.city ? ', ' + f.city : ''}${f.state ? ', ' + f.state : ''}

Date: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}

Subject: Complaint regarding ${labelOf(f.type).toLowerCase()}; request to register an FIR and to take urgent steps to remove the content and preserve digital records.

Respected Sir/Madam,

1. I, ${f.name || '[Your full name]'}, resident of ${f.address || '[Your address]'}, contact number ${f.phone || '[Your phone]'}, wish to report the following offence.

2. Nature of offence: ${labelOf(f.type)}.
   Platform / medium: ${f.platform || '[Platform or phone/e-mail used]'}.
   Account / number of the person responsible (if known): ${f.handle || 'Unknown'}.
   Link(s) to the content: ${f.urls || '[URLs]'}.
   Date and time of the incident(s): ${f.when || '[Date / time]'}.

3. Facts of the case:
${(f.desc || '[Describe what happened, in order, in your own words.]').split('\n').map(l => '   ' + l).join('\n')}

4. I have preserved the relevant digital evidence in a tamper-evident form. Each item carries a SHA-256 hash and a recorded timestamp (Annexure 1). I am ready to hand over the original files and devices.
${ann ? '\nAnnexure 1: Evidence list\n' + ann + '\n' : ''}
5. The facts disclosed appear to attract, among others, the following provisions (indicative; kindly apply the appropriate sections):
${secs.map(s => '   • ' + s).join('\n')}

6. I therefore request that you:
   (a) register an FIR / take cognizance of this complaint;
   (b) issue notice to the concerned intermediary to remove the content at once and to preserve and share account, IP and device logs of the accused;
   (c) take action to identify and apprehend the person responsible; and
   (d) keep my identity confidential and protect me from further harassment.

7. I declare that the above information is true to the best of my knowledge.

Yours faithfully,
${f.name || '[Your name]'}
Phone: ${f.phone || '[Phone]'}

Complaint also filed on the National Cyber Crime Reporting Portal (cybercrime.gov.in): Acknowledgement No. ${f.ack || '[if filed]'}`;
  }

  const PLATFORMS = {
    Instagram: 'Instagram Trust & Safety', Facebook: 'Meta Trust & Safety / Grievance Officer', 'X (Twitter)': 'X Trust & Safety', WhatsApp: 'WhatsApp Grievance Officer (India)',
    Telegram: 'Telegram Abuse team', Snapchat: 'Snap Trust & Safety', YouTube: 'YouTube / Google Grievance Officer', 'Google Search': 'Google (Search removals)', Other: 'Platform Grievance Officer',
  };
  function buildTakedown(f) {
    const nc = ['sextortion', 'nci', 'deepfake', 'impersonation'].includes(f.type);
    return `Subject: URGENT: request to remove ${labelOf(f.type).toLowerCase()} content (${f.platform})

To: ${PLATFORMS[f.platform] || 'Grievance Officer'}

I am the person affected by the content below${f.rep ? ' (reporting as her authorised representative)' : ''}. It violates your community standards and Indian law. Please act on it immediately.

Account / handle: ${f.handle || 'Unknown'}
Content link(s): ${f.urls || '[URLs]'}
Type of violation: ${labelOf(f.type)}
First seen: ${f.when || '[date]'}

${nc ? `This complaint concerns content that exposes private areas, shows nudity or a sexual act, or impersonates me (including morphed or AI-generated images) without my consent. Under Rule 3(2)(b) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, intermediaries are required to remove such content within 24 hours of a complaint by the individual concerned.\n` : `This content constitutes harassment and criminal intimidation. Intermediaries must act on valid complaints under the IT Rules, 2021.\n`}
I request that you:
1. Remove the content and disable the account(s) responsible.
2. Prevent re-uploads of the same or similar content (hash-based blocking).
3. Preserve all related data (account details, IP logs, upload times) for law enforcement. I have filed / will file a complaint${f.ack ? ' (Acknowledgement No. ' + f.ack + ')' : ''} with the cyber crime authorities.
4. Confirm in writing what action you have taken, within 24 hours.

If this is not resolved within the prescribed time, I will escalate to your India Grievance Officer, the Grievance Appeal Committee and the police.

Name: ${f.name || '[Your name]'}
Contact: ${f.phone || '[Phone / e-mail]'}`;
  }

  return { analyze, buildComplaint, buildTakedown, labelOf, sectionsFor, T, PLATFORMS };
})();

if (typeof module !== 'undefined') module.exports = { Legal };

/* ============================== VIEW ============================== */
(function () {
  let tab = 'analyze', draft = { type: 'sextortion', platform: 'Instagram' };
  const TYPES = Object.entries(Legal.T).map(([k, v]) => [k, v.label]);

  Router.register('report', async root => {
    const tabs = [['analyze', 'Understand'], ['complaint', 'Complaint letter'], ['takedown', 'Platform takedown'], ['cases', 'Case tracker']];
    root.innerHTML = `<div class="page"><div class="page-head"><div class="eyebrow">${icon('file')} Report &amp; Takedown</div><h1>From panic to a plan.</h1>
      <p class="lead">Describe what is happening. Kavach explains it, drafts the complaint and takedown notice, and tracks every follow-up so nothing slips.</p></div>
      <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button class="tab ${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div id="rbody"></div></div>`;
    $$('.tab', root).forEach(b => b.onclick = () => { tab = b.dataset.tab; Router.render(); });
    await ({ analyze: analyzeTab, complaint: complaintTab, takedown: takedownTab, cases: casesTab })[tab]($('#rbody'));
  });

  const typeSelect = (id, val) => `<select id="${id}">${TYPES.map(([k, l]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const field = (id, label, ph = '', val = '', tag = 'input') => `<div class="field"><label for="${id}">${label}</label>${tag === 'textarea' ? `<textarea id="${id}" placeholder="${esc(ph)}">${esc(val)}</textarea>` : `<input type="text" id="${id}" placeholder="${esc(ph)}" value="${esc(val)}">`}</div>`;

  /* ---------- analyze ---------- */
  function analyzeTab(body) {
    body.innerHTML = `<div class="split"><div class="card"><div class="card-title"><span class="ic coral">${icon('search')}</span>What is happening?</div>
      <div class="field"><label for="at">Paste the message, or describe the situation</label><textarea id="at" style="min-height:170px" placeholder="e.g. He has my private photos and says he will send them to my family unless I pay ₹15,000 by tonight."></textarea></div>
      <div class="row"><button class="btn primary" id="an">${icon('search')} Analyze</button><span class="hint">Runs on your device. Nothing is sent anywhere.</span></div></div>
      <div id="ar" class="stack"><div class="card muted center">Your analysis will appear here.</div></div></div>`;
    $('#an').onclick = () => {
      const text = $('#at').value.trim(); if (!text) return toast('Please write or paste something first', 'warn');
      const r = Legal.analyze(text), risk = window.Risk ? Risk.assess(text) : { level: 0 };
      const U = { critical: ['danger', 'Critical: act today'], high: ['warn', 'High priority'], medium: ['gray', 'Needs attention'] }[r.urgency];
      const hi = text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
      const marked = r.found.flatMap(f => f.cues).filter(Boolean).reduce((h, c) => h.replace(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), m => `<mark>${m}</mark>`), hi);
      $('#ar').innerHTML = `${risk.level >= 1 ? `<div class="card danger"><div class="card-title">${icon('heart')} First, you matter more than any of this</div><p>Some of what you wrote sounds like you may be in a very dark place. You do not have to face this alone: free, confidential support is available any time.</p>
          <div class="row"><a class="btn danger" href="#/sahara">Talk to Sahara</a><a class="btn" href="tel:14416">${icon('phone')} Tele-MANAS 14416</a><a class="btn" href="tel:112">${icon('phone')} 112</a></div></div>` : ''}
        <div class="card"><div class="spread"><div class="card-title" style="margin:0">Assessment</div><span class="chip ${U[0]}">${U[1]}</span></div>
          ${r.found.length ? r.found.map(f => `<div class="entry" style="margin-top:12px"><b>${esc(f.label)}</b><div class="hint">Matched: ${f.cues.map(c => `“${esc(c)}”`).join(', ')}</div>
            <div class="small" style="margin-top:6px">Provisions that may apply (indicative): ${f.secs.map(s => `<span class="chip gray" style="margin:2px">${esc(s)}</span>`).join('')}</div></div>`).join('') : '<p class="muted" style="margin-top:12px">No specific pattern recognised. You can still document and report it. Choose the closest type below.</p>'}
          <div class="letter" style="margin-top:14px;max-height:160px;font-family:inherit">${marked}</div></div>
        <div class="card tint"><div class="card-title">Recommended next steps</div><div class="steps">
          <div class="step"><div><h3>Preserve before anything else</h3><p>Screenshot the chat, profile and any payment request. Do not delete.</p></div></div>
          <div class="step"><div><h3>${r.urgency === 'critical' ? 'Do not pay. Call 1930 now' : 'Report to the cyber cell'}</h3><p>Online at cybercrime.gov.in or by phone on 1930.</p></div></div>
          <div class="step"><div><h3>Get the content taken down</h3><p>Send a takedown notice. Platforms must act within 24 hours on intimate or impersonation content.</p></div></div></div>
          <div class="row" style="margin-top:14px"><a class="btn coral" href="#/vault?new">${icon('lock')} Save evidence</a><button class="btn primary" id="mk">Draft complaint →</button></div></div>`;
      $('#mk').onclick = () => { draft = { ...draft, type: (r.found[0] || {}).key || draft.type, desc: text }; tab = 'complaint'; Router.render(); };
    };
  }

  /* ---------- complaint ---------- */
  async function complaintTab(body) {
    const evid = Store.isOpen() ? (await Vault.list()).reverse() : [], net = Store.isOpen() ? await Store.get('kv', 'net', {}) : {};
    draft = { name: net.name, phone: net.phone, ...draft };
    body.innerHTML = `<div class="split"><div class="card"><div class="card-title"><span class="ic">${icon('file')}</span>Complaint details</div>
      <div class="field"><label>Type of offence</label>${typeSelect('ct', draft.type)}</div>
      <div class="grid g2">${field('cn', 'Your name', 'Full name', draft.name)}${field('cp', 'Your phone', '+91…', draft.phone)}</div>
      ${field('ca', 'Your address (optional)', '', draft.address)}
      <div class="grid g2">${field('cc', 'City', '', draft.city)}${field('cs', 'State', '', draft.state)}</div>
      <div class="grid g2">${field('cpl', 'Platform / medium', 'Instagram, WhatsApp…', draft.platform)}${field('chh', 'Their handle / number', '', draft.handle)}</div>
      ${field('cu', 'Link(s)', 'https://…', draft.urls)}${field('cw', 'When did it happen?', 'e.g. 5–7 Nov 2026', draft.when)}
      ${field('cd', 'What happened?', 'Describe in order, in your own words.', draft.desc, 'textarea')}${field('ck', 'cybercrime.gov.in acknowledgement no. (if filed)', '', draft.ack)}
      ${evid.length ? `<div class="lbl" style="margin-bottom:6px">Attach evidence from your vault</div><div class="stack">${evid.map(e => `<label class="chk"><input type="checkbox" class="ev" value="${e.id}" checked><span><b>${esc(e.platform)}</b> ${esc(e.handle || '')} <span class="hint">${fmt(e.createdAt)}</span></span></label>`).join('')}</div>` : '<p class="hint">Evidence saved in your vault can be attached automatically.</p>'}</div>
      <div class="stack"><div class="card"><div class="spread"><div class="card-title" style="margin:0">Your letter</div><span class="chip warn">Draft</span></div>
        <div class="letter" id="lt" style="margin:12px 0"></div>
        <div class="row"><button class="btn primary" id="lcopy">${icon('copy')} Copy</button><button class="btn" id="ldl">${icon('download')} Download .txt</button><button class="btn" id="lprint">${icon('file')} Print / PDF</button></div>
        <p class="hint" style="margin-top:10px">Kavach is a self-help tool, not legal advice. Sections shown are indicative; the police decide the final provisions. Please have a lawyer or legal-aid cell review before filing.</p></div>
        <a class="btn coral block" href="https://cybercrime.gov.in" target="_blank" rel="noopener">${icon('link')} Open cybercrime.gov.in to file</a>
        <button class="btn block" id="mkcase">${icon('plus')} Start a case in my tracker</button></div></div>`;
    const read = () => ({ type: $('#ct').value, name: $('#cn').value, phone: $('#cp').value, address: $('#ca').value, city: $('#cc').value, state: $('#cs').value, platform: $('#cpl').value, handle: $('#chh').value, urls: $('#cu').value, when: $('#cw').value, desc: $('#cd').value, ack: $('#ck').value, evidence: evid.filter(e => $$('.ev:checked').some(c => c.value === e.id)) });
    const draw = () => { draft = { ...draft, ...read() }; $('#lt').textContent = Legal.buildComplaint(draft); };
    draw(); $$('input,select,textarea', body).forEach(i => i.addEventListener('input', debounce(draw, 150)));
    $('#lcopy').onclick = () => copy($('#lt').textContent);
    $('#ldl').onclick = () => download('complaint-draft.txt', $('#lt').textContent);
    $('#lprint').onclick = () => { const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to print', 'warn'); w.document.write(`<pre style="font:14px/1.7 Georgia,serif;white-space:pre-wrap;max-width:780px;margin:30px auto">${esc($('#lt').textContent)}</pre>`); w.document.close(); w.print(); };
    $('#mkcase').onclick = async () => { await newCase(read()); tab = 'cases'; Router.render(); };
  }

  /* ---------- takedown ---------- */
  async function takedownTab(body) {
    body.innerHTML = `<div class="split"><div class="card"><div class="card-title"><span class="ic coral">${icon('send')}</span>Takedown notice</div>
      <div class="field"><label>Platform</label><select id="tp">${Object.keys(Legal.PLATFORMS).map(p => `<option ${p === draft.platform ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
      <div class="field"><label>What kind of content?</label>${typeSelect('tt', draft.type)}</div>
      ${field('th', 'Account / handle', '', draft.handle)}${field('tu', 'Link(s) to the content', 'one per line', draft.urls, 'textarea')}${field('tw', 'First seen', '', draft.when)}
      <div class="grid g2">${field('tn', 'Your name', '', draft.name)}${field('tc', 'Your contact', '', draft.phone)}</div>
      <label class="chk"><input type="checkbox" id="tr"><span>I am reporting on behalf of the affected woman</span></label></div>
      <div class="stack"><div class="card"><div class="card-title">Your notice</div><div class="letter" id="tl2"></div>
        <div class="row" style="margin-top:12px"><button class="btn primary" id="tcopy">${icon('copy')} Copy</button><button class="btn coral" id="tsent">${icon('clock')} I sent it: start 24h timer</button></div></div>
        <div class="card safe"><div class="card-title">${icon('shield')} Stop it spreading</div><p class="small">For intimate images, also register the photo with <a href="https://stopncii.org" target="_blank" rel="noopener">StopNCII.org</a> (adults) so participating platforms block copies. If you were under 18 when the image was taken, use <a href="https://takeitdown.ncmec.org" target="_blank" rel="noopener">Take It Down</a>.</p></div></div></div>`;
    const read = () => ({ platform: $('#tp').value, type: $('#tt').value, handle: $('#th').value, urls: $('#tu').value, when: $('#tw').value, name: $('#tn').value, phone: $('#tc').value, rep: $('#tr').checked, ack: draft.ack });
    const draw = () => { draft = { ...draft, ...read() }; $('#tl2').textContent = Legal.buildTakedown(draft); };
    draw(); $$('input,select,textarea', body).forEach(i => i.addEventListener('input', debounce(draw, 150)));
    $('#tcopy').onclick = () => copy($('#tl2').textContent);
    $('#tsent').onclick = async () => {
      if (!Store.isOpen()) return toast('Unlock Kavach first', 'warn');
      const c = await newCase({ ...read(), desc: draft.desc }); c.platformReport = { at: new Date().toISOString(), due: new Date(Date.now() + 24 * 3600e3).toISOString() };
      await Store.put('cases', c.id, c); toast('Timer started: follow-up due in 24 hours'); tab = 'cases'; Router.render();
    };
  }

  /* ---------- cases ---------- */
  async function newCase(f) {
    const c = { id: uid(), title: `${Legal.labelOf(f.type)}${f.handle ? ' · ' + f.handle : ''}`, type: f.type, platform: f.platform, createdAt: new Date().toISOString(), platformReport: null, police: null, resolved: null };
    if (Store.isOpen()) await Store.put('cases', c.id, c);
    return c;
  }
  const left = iso => { const ms = new Date(iso) - Date.now(), a = Math.abs(ms), h = Math.floor(a / 3600e3), m = Math.floor(a % 3600e3 / 60e3); return { over: ms < 0, txt: `${h}h ${m}m` }; };

  async function casesTab(body) {
    if (!Store.isOpen()) { body.innerHTML = '<div class="card warn">Unlock Kavach to see your cases.</div>'; return; }
    const cases = (await Store.all('cases')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    body.innerHTML = `<div class="spread" style="margin-bottom:14px"><p class="muted" style="margin:0">One place to see what you have reported, what is overdue, and what to do next.</p><button class="btn primary" id="nc">${icon('plus')} New case</button></div>
      <div class="stack">${cases.length ? cases.map(c => {
        const steps = [['Evidence saved', c.createdAt], ['Reported to platform', c.platformReport && c.platformReport.at], ['Police / portal complaint', c.police && c.police.at], ['Resolved', c.resolved]], doneN = steps.filter(s => s[1]).length;
        const d = c.platformReport && !c.resolved ? left(c.platformReport.due) : null;
        return `<div class="card"><div class="spread"><div><b style="font-size:1.1rem">${esc(c.title)}</b><div class="hint">Opened ${fmt(c.createdAt)}${c.platform ? ' · ' + esc(c.platform) : ''}</div></div>
          <span class="chip ${c.resolved ? 'safe' : d && d.over ? 'danger' : 'warn'}">${c.resolved ? 'Resolved' : d ? (d.over ? 'Platform overdue ' + d.txt : 'Platform due in ' + d.txt) : 'In progress'}</span></div>
          <div class="progress" style="margin:14px 0"><i style="width:${doneN / 4 * 100}%"></i></div>
          <div class="grid g4">${steps.map(s => `<div class="small"><span class="chip ${s[1] ? 'safe' : 'gray'}">${s[1] ? '✓' : '○'}</span> ${s[0]}</div>`).join('')}</div>
          ${d && d.over ? `<div class="card warn" style="margin-top:12px"><b>The 24-hour window has passed.</b> Escalate: write to the platform’s India Grievance Officer, appeal to the Grievance Appeal Committee, and make sure the police complaint is filed (call 1930).</div>` : ''}
          ${c.police && c.police.ack ? `<p class="small" style="margin-top:10px">Acknowledgement no: <b>${esc(c.police.ack)}</b></p>` : ''}
          <div class="row" style="margin-top:14px">
            ${!c.platformReport ? `<button class="btn sm" data-a="plat" data-id="${c.id}">Mark reported to platform</button>` : ''}
            ${!c.police ? `<button class="btn sm" data-a="pol" data-id="${c.id}">Mark complaint filed</button>` : ''}
            ${!c.resolved ? `<button class="btn sm safe" data-a="res" data-id="${c.id}">Mark resolved</button>` : ''}
            <button class="btn sm ghost" data-a="del" data-id="${c.id}">${icon('trash')}</button></div></div>`; }).join('') : `<div class="card center"><p class="muted">No cases yet. Create one when you report something, and Kavach will track the deadlines.</p></div>`}</div>`;
    $('#nc').onclick = async () => { await newCase({ type: draft.type, platform: draft.platform, handle: draft.handle }); Router.render(); };
    $$('[data-a]', body).forEach(b => b.onclick = async () => {
      const c = cases.find(x => x.id === b.dataset.id), now = new Date().toISOString();
      if (b.dataset.a === 'plat') c.platformReport = { at: now, due: new Date(Date.now() + 24 * 3600e3).toISOString() };
      if (b.dataset.a === 'pol') { const ack = prompt('Acknowledgement / complaint number (optional)') || ''; c.police = { at: now, ack }; }
      if (b.dataset.a === 'res') c.resolved = now;
      if (b.dataset.a === 'del') { if (!confirm('Delete this case?')) return; await Store.del('cases', c.id); return Router.render(); }
      await Store.put('cases', c.id, c); Router.render();
    });
  }
})();
