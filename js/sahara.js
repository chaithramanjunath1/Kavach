'use strict';
/*
 * Sahara — emotional support, designed around consent and honesty.
 *
 *  • Risk is detected ON DEVICE, locally, before anything else happens. Crisis flows never depend on a network call.
 *  • Sahara is a supportive companion, not a therapist and not a person. It says so, and always offers real humans:
 *    Tele-MANAS 14416 (also 1800-89-14416), Women Helpline 181, emergency 112.
 *  • The escalation ladder is configured by the woman herself, while she is calm:
 *      circle (trusted people) → wait for someone to respond → 112 package.
 *    She sees a countdown and can cancel. Chat contents go to 112 only if she opted in (default: location + phone + risk summary).
 *  • A browser cannot silently send SMS or reach 112. Without a relay (CONFIG.alertEndpoint) this prototype runs in clearly
 *    labelled SIMULATION mode, or hands the user one-tap SMS/WhatsApp/call buttons. It never pretends help was dispatched.
 */
const CONFIG = {
  llmEndpoint: '',     // optional: POST {messages, risk} → {reply}. Safety detection still runs locally first.
  alertEndpoint: '',   // optional: POST {kind:'circle'|'112', ...} to a server that relays SMS/WhatsApp / ERSS-112 integration.
  get demo() { try { return localStorage.getItem('kv_demo') !== '0'; } catch { return true; } },
  set demo(v) { try { localStorage.setItem('kv_demo', v ? '1' : '0'); } catch {} },
};

/* ------------------------------------------------------------------ risk */
const Risk = (() => {
  const HIGH = [
    /\b(suicide|suicidal)\b/i, /\bkill(ing)? myself\b/i, /\b(end(ing)?|take|taking) (my (own )?life|it all)\b/i,
    /\bwant(ed)? to die\b|\bwanna die\b|\bbetter off dead\b|\bwish (i|that i) (was|were) dead\b/i,
    /\bno reason to (live|go on)\b|\bdo(n'?t| not) want to (live|be alive|exist|wake up)\b/i,
    /\b(going|planning|about) to (die|kill myself|end (it|my life))\b/i,
    /आत्महत्या|खुदकुशी|मरना चाहती|मर जाना चाहती|जीना नहीं चाहती|जान दे दू/,
    /\b(marna chahti|mar jana chahti|khudkushi|jeena nahi chahti|jaan de dungi|suicide kar)/i,
  ];
  const PLAN = /\b(pills|tablets|overdose|rope|hang(ing)? myself|jump(ing)? (off|from)|bridge|terrace|roof|knife|blade|poison|pesticide|gun|tonight|right now|this (evening|night)|after everyone sleeps|goodbye|note)\b/i;
  const PASSIVE = /\b(disappear|can'?t (go on|do this( any ?more)?|take (it|this)( any ?more)?|cope)|tired of (living|life|everything|fighting)|no way out|nobody would (care|miss)|everyone (would be|is) better (off )?without me|i('m| am) a burden|worthless|hopeless|nothing matters|life is (pointless|meaningless))\b/i;

  function assess(text) {
    const s = String(text || '');
    const high = HIGH.some(r => r.test(s)), plan = PLAN.test(s), passive = PASSIVE.test(s);
    return { level: high && plan ? 3 : high ? 2 : passive ? 1 : 0, high, plan, passive };
  }
  return { assess };
})();

/* ------------------------------------------------------------- companion */
const Companion = (() => {
  const state = { awaiting: null, turn: 0, level: 0, lastSafety: '' };
  const transcript = [];
  const pick = (arr, n) => arr[n % arr.length];
  const Q_SAFE = [{ l: "I'm safe right now", v: '__safe__' }, { l: "I'm not sure I'll stay safe", v: '__unsure__' }, { l: "I'm in danger right now", v: '__danger__' }];

  const imminent = () => { state.awaiting = null; state.level = 3; return { level: 3, act: 'esc', msgs: ["I'm really worried about you, and I want you to be safe right now.", "I'm going to help you reach people immediately. You don't have to do anything except stay here with me."], quick: [] }; };
  const safetyCheck = () => { state.awaiting = 'safety'; state.level = Math.max(state.level, 2); return { level: 2, msgs: ["Thank you for telling me. I'm really glad you said it out loud, and I'm taking it seriously.", "You deserve real people in this with you. First I need to know where things stand: are you safe at this moment?"], quick: Q_SAFE }; };
  const afterSafe = () => { state.awaiting = null; return { level: 2, msgs: ["I'm glad you're safe right now. Let's make this moment a little safer together.", "If there is anything near you that you could use to hurt yourself, could you put some distance between you and it? Another room, or with someone else.", "Would you be willing to talk with a trained counsellor on Tele-MANAS, 14416? It's free, 24x7, and they speak your language. I'll stay right here while you call."], quick: [{ l: 'Call Tele-MANAS 14416', act: 'call14416' }, { l: 'Let my trusted circle know', act: 'circle' }, { l: 'Build a safety plan', act: 'plan' }, { l: 'Keep talking', v: '__keep__' }] }; };

  const INTENTS = [
    { id: 'blackmail', rx: /blackmail|sextort|(photo|pic|video|nude|leak|viral).{0,40}(send|post|share|leak|viral|money|pay)|threaten(ing|ed)? (to )?(share|post|leak|send)/i,
      msgs: ["I'm so sorry. This is frightening, and it is not your fault. Threatening to share someone's images is a crime, and there are things that work.", "Please don't pay and don't delete anything: both matter. I can open the emergency guide, which walks through exactly what to do, step by step."],
      quick: [{ l: 'Open the emergency guide', act: 'sos' }, { l: 'Not right now', v: '__keep__' }] },
    { id: 'abuse', rx: /(husband|partner|boyfriend|father|brother|in-?laws?|family|he).{0,40}(hit|beat|abuse|hurt|control|choke|threat)|domestic violence|he hits me|beats me/i,
      msgs: ["I'm really sorry you're living with that. Your safety comes first.", "If you are in danger right now, call 112. The Women Helpline 181 is also available 24x7. Are you safe at this moment?"], quick: Q_SAFE, setAwait: 'safety' },
    { id: 'shame', rx: /ashamed|shame|embarrass|my fault|blame myself|disgust(ed|ing)? with myself|ruined/i,
      msgs: ["What was done to you is not something you did. Shame is exactly what people who hurt others want you to carry. It says nothing true about your worth.", "Many women have been exactly where you are, and many have come through it. What feels heaviest right now?"] },
    { id: 'anxiety', rx: /anxious|anxiety|panic|can'?t breathe|heart (is )?racing|overwhelm|so scared|terrified|afraid/i,
      msgs: ["That sounds really intense, and your body is doing what bodies do when they feel in danger. It will pass. Let's slow it down together.", "Would you like to try a minute of slow breathing, or a grounding exercise using your senses?"], quick: [{ l: 'Breathe with me', act: 'breathe' }, { l: '5-4-3-2-1 grounding', act: 'ground' }] },
    { id: 'lonely', rx: /lonely|all alone|no one (cares|understands|to talk)|nobody (cares|understands)|isolated/i,
      msgs: ["Feeling alone hurts, and I'm glad you reached out instead of sitting with it. I'm here.", "Is there one person you trust, even someone you haven't spoken to in a while? I can help you find the words to message them today."], quick: [{ l: 'Help me write that message', v: '__draftmsg__' }, { l: 'Not yet', v: '__keep__' }] },
    { id: 'sleep', rx: /can'?t sleep|insomnia|nightmare|sleepless/i,
      msgs: ["Nights can be the hardest when the mind won't switch off. Try this: breathe in for 4, out for 6, a few times, and let each thought pass like a cloud without chasing it.", "If sleeplessness keeps going for days, a counsellor on Tele-MANAS (14416) can help with that too."], quick: [{ l: 'Breathe with me', act: 'breathe' }] },
    { id: 'anger', rx: /\b(furious|so angry|rage|hate (him|them|everyone))\b/i,
      msgs: ["Anger makes sense here. Something unfair was done to you. You can be angry and still be safe, and you can let it move through you without acting on it tonight.", "Would it help to write down everything you'd say to them, privately, without sending it? Or shall we plan the next practical step?"] },
    { id: 'thanks', rx: /^(thanks|thank you|thankyou|shukriya|dhanyavaad)\b/i,
      msgs: ["I'm glad you're here. I'm not going anywhere. Remember, the helplines are free and always on whenever you want a human voice."] },
    { id: 'greet', rx: /^(hi+|hello|hey|namaste|hlo|hii+)\b/i,
      msgs: ["Hi, I'm Sahara. I'm here to listen, without judgment. What you say here isn't saved unless you choose to.", "How are you really feeling today?"], quick: [{ l: "I'm anxious", v: "I'm feeling anxious" }, { l: "I'm being harassed online", v: "I'm being harassed online" }, { l: 'I just need to talk', v: '__keep__' }] },
  ];
  const FALLBACK = [
    "I'm listening. Tell me a little more about what has been happening?",
    "Thank you for sharing that. What feels hardest about it right now?",
    "That sounds like a lot to carry. What do you need most at this moment: to vent, to calm down, or to work out a next step?",
  ];

  function reply(raw) {
    state.turn++;
    const tok = /^__(\w+)__$/.exec(raw || '');
    const text = tok ? '' : String(raw || '').trim();

    if (tok) {
      const k = tok[1];
      if (k === 'keep') return { level: 0, msgs: ["Of course. I'm here. What has been weighing on you most?"], quick: [] };
      if (k === 'draftmsg') return { level: 0, msgs: ["Here's something you can send as it is, or change:\n\n“Hey, I've been having a rough time and I don't want to be alone with it. Can you talk, or just stay on a call with me for a bit?”", "Short and honest is enough. People usually want to help and just don't know it's needed."], quick: [] };
      if (state.awaiting === 'ideation') {
        state.awaiting = null;
        if (k === 'yes' || k === 'unsure') return safetyCheck();
        return { level: 1, msgs: ["Thank you for telling me honestly. Being this worn out matters too.", "If that ever changes, even for a moment, tell me and we'll get you support right away. For now, what has been weighing on you most?"], quick: [] };
      }
      if (['safe', 'unsure', 'danger'].includes(k)) {
        state.lastSafety = { safe: 'said she is safe right now', unsure: 'not sure she will stay safe', danger: 'said she is in danger right now' }[k];
        if (k === 'safe') return afterSafe();
        state.level = k === 'danger' ? 3 : 2;
        return { level: state.level, act: 'esc', msgs: ["Thank you for being honest. I'm going to help you reach people right now. You don't have to do any of it alone."], quick: [] };
      }
    }

    const risk = Risk.assess(text);
    if (state.awaiting === 'safety' && !risk.high) {
      if (/danger|not safe|unsafe|about to|going to|have (them|it|the)|can'?t stay safe|i will/i.test(text)) return reply('__danger__');
      if (/\b(safe|ok|okay|fine|alright)\b/i.test(text)) return reply('__safe__');
      return { level: 2, msgs: ["I want to be sure I understand. Are you safe right now?"], quick: Q_SAFE };
    }
    if (risk.level === 3) return imminent();
    if (risk.level === 2) return safetyCheck();
    if (risk.level === 1) { state.awaiting = 'ideation'; state.level = Math.max(state.level, 1); return { level: 1, msgs: ["That sounds exhausting. Carrying this much for this long would wear anyone down.", "I want to ask you something directly, because I care: are you having thoughts of ending your life?"], quick: [{ l: 'Yes', v: '__yes__' }, { l: "No, I'm just exhausted", v: '__no__' }, { l: 'Not sure', v: '__unsure__' }] }; }

    const it = INTENTS.find(i => i.rx.test(text));
    if (it) { if (it.setAwait) state.awaiting = it.setAwait; return { level: 0, intent: it.id, msgs: it.msgs, quick: it.quick || [] }; }
    return { level: 0, msgs: [pick(FALLBACK, state.turn)], quick: [{ l: 'Help me calm down', act: 'breathe' }, { l: 'I need practical steps', act: 'sos' }, { l: 'I just want to talk', v: '__keep__' }] };
  }
  const reset = () => { state.awaiting = null; state.turn = 0; state.level = 0; state.lastSafety = ''; transcript.length = 0; };
  return { reply, state, transcript, reset };
})();

/* ---------------------------------------------------------- safety net */
const Net = {
  def: () => ({ name: '', phone: '', circle: [], consent: { alertCircle: false, share112: false, share: 'summary' }, plan: {} }),
  async load() { try { if (Store.isOpen()) return Object.assign(Net.def(), await Store.get('kv', 'net', Net.def())); } catch {} return Net.def(); },
  async save(n) { await Store.put('kv', 'net', n); },
};
const Geo = {
  get: () => new Promise(res => { if (!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition(p => res({ lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), accuracy_m: Math.round(p.coords.accuracy) }), () => res(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }); }),
  link: l => l ? `https://maps.google.com/?q=${l.lat},${l.lon}` : '(location unavailable)',
};

/* ---------------------------------------------------------- escalation */
const Escalation = (() => {
  let timers = [], S = null, opts = null, net = null, plan = null;
  const clear = () => { timers.forEach(clearInterval); timers = []; };
  const now = () => new Date().toLocaleTimeString('en-IN');
  const addLog = (t, k = '') => { S.log.push({ t, k, at: now() }); };
  const digits = p => String(p || '').replace(/[^\d+]/g, '');

  async function buildPayload(kind) {
    const loc = await Geo.get(), share = net.consent.share || 'summary';
    const p = { kind, time: new Date().toISOString(), person: { name: net.name || 'Not provided', phone: net.phone || 'Not provided' }, location: loc ? { ...loc, map: Geo.link(loc) } : 'unavailable',
      risk: 'Supportive companion flagged a HIGH risk of self-harm. The person may be in immediate danger.' };
    if (share === 'summary') p.summary = `She expressed thoughts of ending her life during a chat (risk level ${Companion.state.level} of 3). When asked if she was safe, she ${Companion.state.lastSafety || 'did not answer'}.`;
    if (share === 'full') p.transcript = Companion.transcript.slice(-40).map(m => ({ from: m.role, text: m.text, at: m.at }));
    return p;
  }
  const circleText = (p, c) => `Kavach alert for ${c.name}: ${net.name || 'Your loved one'} told a support companion that she may be in danger and may hurt herself. Please call her right now${net.phone ? ' on ' + net.phone : ''}. Last known location: ${typeof p.location === 'object' ? p.location.map : 'not available'}. If you cannot reach her, call 112. She chose to share this with you.`;

  async function relay(kind, payload) {
    try { const r = await fetch(CONFIG.alertEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, payload }) }); return r.ok; } catch { return false; }
  }

  async function doCircle() {
    S.phase = 'circle'; addLog('Preparing the alert for your trusted circle…'); paint();
    const p = await buildPayload('circle');
    if (CONFIG.alertEndpoint) { const ok = await relay('circle', { contacts: net.circle, messages: net.circle.map(c => ({ to: c.phone, text: circleText(p, c) })), ...p }); addLog(ok ? `Alert relayed to ${net.circle.map(c => c.name).join(', ')} via your alert service.` : 'The alert service could not be reached. Use the buttons below to message them now.', ok ? 'ok' : 'sim'); }
    else if (CONFIG.demo) addLog(`SIMULATION: an SMS and WhatsApp message would now be sent to ${net.circle.map(c => c.name).join(', ')}. Nothing was actually sent.`, 'sim');
    else addLog('Tap the buttons below to send the prepared message to each person. Your browser cannot send messages silently.', 'sim');
    S.circlePayload = p; paint();
  }

  async function do112() {
    S.phase = '112'; addLog('Preparing the emergency package for 112…'); paint();
    const p = await buildPayload('112'); S.pkg = p;
    if (CONFIG.alertEndpoint) { const ok = await relay('112', p); addLog(ok ? 'Emergency package sent through your alert service.' : 'Could not reach the alert service. Please call 112 now.', ok ? 'ok' : 'sim'); }
    else if (CONFIG.demo) addLog('SIMULATION: this is the package that would be handed to emergency services. Nothing was actually sent or dialed.', 'sim');
    else { addLog('Opening your phone dialer for 112. The details below are ready to read out or copy.', 'ok'); setTimeout(() => { location.href = 'tel:112'; }, 700); }
    paint();
  }

  async function next() {
    if (S.autoCircle) {
      await doCircle();
      if (S.auto112) { S.phase = 'wait'; S.n = S.ackWait; addLog(`Waiting up to ${S.ackWait}s for someone in your circle to respond…`); startWait(); }
      else S.phase = 'done';
    } else if (S.auto112) { await do112(); S.phase = 'done'; }
    else S.phase = 'done';
    paint();
  }
  function startWait() { clear(); timers.push(setInterval(async () => { S.n--; if (S.n <= 0) { clear(); addLog('No response in time. Escalating.'); await do112(); S.phase = 'done'; } paint(); }, 1000)); }
  function startCount() { clear(); timers.push(setInterval(() => { S.n--; if (S.n <= 0) { clear(); next(); } paint(); }, 1000)); }

  function ack(who = 'Someone in your circle') { if (!S) return toast('Open an escalation first', 'warn'); clear(); S.acked = true; S.phase = 'done'; addLog(`${who} replied and is on the way / calling you. Escalation to 112 cancelled.`, 'ok'); paint(); }
  function close() { clear(); S = null; $('#overlay').innerHTML = ''; document.body.style.overflow = ''; }

  function contactBtns(p) {
    return net.circle.map(c => {
      const msg = encodeURIComponent(circleText(p || { location: 'not available' }, c)), ph = digits(c.phone);
      return `<div class="hl"><div><b style="font-size:1.1rem">${esc(c.name)}</b><span>${esc(c.rel || 'Trusted contact')} · ${esc(c.phone)}</span></div><div class="row">
        <a class="btn sm safe" href="tel:${ph}">${icon('phone')} Call</a><a class="btn sm" href="sms:${ph}?body=${msg}">SMS</a><a class="btn sm" href="https://wa.me/${ph.replace('+', '')}?text=${msg}" target="_blank" rel="noopener">WhatsApp</a></div></div>`;
    }).join('');
  }

  function paint() {
    if (!S) return;
    const names = net.circle.map(c => c.name).join(', ');
    let phase = '';
    if (S.phase === 'count') {
      const what = S.autoCircle ? `Alerting <b>${esc(names)}</b> in ${S.n} second${S.n === 1 ? '' : 's'}${S.auto112 ? '. If no one responds after that, emergency services (112) are contacted' : ''}.` : `Sharing your location and phone number with emergency services (<b>112</b>) in ${S.n} second${S.n === 1 ? '' : 's'}.`;
      phase = `<div class="card center"><div class="big-count" style="color:var(--coral)">${S.n}</div><p style="margin:8px 0 14px">${what}<br><span class="muted small">You set this up because you wanted help to come even if you couldn't ask.</span></p>
        <button class="btn lg block" id="esc-cancel">I'm okay: cancel</button></div>`;
    } else if (S.phase === 'wait') {
      phase = `<div class="card center"><div class="big-count" style="color:var(--coral)">${S.n}</div><p style="margin:8px 0">seconds for someone in your circle to respond before 112 is contacted.</p></div>`;
    } else if (!S.auto) {
      phase = `<div class="card warn"><b>Nothing is sent automatically.</b> You have not turned on automatic alerts, so you decide who to reach. You can set this up any time under <i>Sahara → My safety net</i>.</div>`;
    }
    const pkg = S.pkg ? `<div class="card"><div class="card-title">${icon('pin')} Emergency package for 112</div>${CONFIG.demo && !CONFIG.alertEndpoint ? '<div class="simbanner" style="margin-bottom:10px">SIMULATION: nothing was sent</div>' : ''}<pre class="code">${esc(JSON.stringify(S.pkg, null, 2))}</pre><div class="row" style="margin-top:10px"><button class="btn sm" id="esc-copy">${icon('copy')} Copy details</button><a class="btn sm danger" href="tel:112">${icon('phone')} Call 112</a></div></div>` : '';
    $('#overlay').innerHTML = `<div class="esc"><div class="esc-in">
      <div class="spread"><div class="eyebrow" style="color:#FFD08A">Sahara · support now</div><button class="btn sm ghost" id="esc-close" style="color:#fff;border-color:rgba(255,255,255,.4)">Back to chat</button></div>
      <h1>You are not alone. Let's get people to you.</h1>
      ${CONFIG.demo ? `<div class="simbanner">SIMULATION MODE: no SMS or message is actually sent and nothing is auto-dialed. Buttons that begin a phone call will dial for real.</div>` : ''}
      ${phase}
      <div class="grid g2"><a class="btn danger lg" href="tel:112">${icon('phone')} Call 112 · Emergency</a><a class="btn safe lg" href="tel:14416">${icon('phone')} Tele-MANAS 14416</a></div>
      ${net.circle.length ? `<div class="card"><div class="card-title">${icon('users')} Your trusted circle</div><div class="stack">${contactBtns(S.circlePayload)}</div>
        ${!S.autoCircle || S.phase === 'done' ? `<button class="btn block" id="esc-circle" style="margin-top:12px">${icon('send')} Prepare alert for my circle</button>` : ''}</div>` : `<div class="card"><b>You haven't added trusted people yet.</b><p class="small muted">You can add them in Sahara → My safety net. For now, 112 and Tele-MANAS are one tap away.</p></div>`}
      ${S.log.length ? `<div class="card"><div class="card-title">What is happening</div><div class="log">${S.log.map(l => `<div class="${l.k}"><b>${l.at}</b> · ${esc(l.t)}</div>`).join('')}</div></div>` : ''}
      ${pkg}
      ${S.phase === 'done' ? `<div class="card"><p style="margin:0 0 10px">Whatever you are feeling is real, and so is the help. Stay with someone, or stay on a call, until you feel steadier.</p><button class="btn block" id="esc-safe">I'm safe now</button></div>` : ''}
      </div></div>`;
    document.body.style.overflow = 'hidden';
    const on = (id, fn) => { const e = $('#' + id); if (e) e.onclick = fn; };
    on('esc-cancel', () => { clear(); S.phase = 'done'; S.auto = false; addLog('You cancelled the automatic alert. Nothing was sent.', 'ok'); paint(); });
    on('esc-close', close); on('esc-safe', close);
    on('esc-copy', () => copy(JSON.stringify(S.pkg, null, 2)));
    on('esc-circle', async () => { await doCircle(); S.phase = 'done'; paint(); });
  }

  async function start(o = {}) {
    clear(); opts = o; net = await Net.load();
    const c = net.consent || {}, hasCircle = net.circle.length > 0;
    const forced = o.force === 'circle';
    const autoCircle = forced ? hasCircle : hasCircle && c.alertCircle;
    const auto112 = forced ? false : !!c.share112;
    S = { phase: 'count', n: forced ? 5 : (o.level >= 3 ? 10 : 20), log: [], autoCircle, auto112, auto: autoCircle || auto112, ackWait: CONFIG.demo ? 15 : 120, acked: false };
    if (!S.auto) S.phase = 'idle';
    paint();
    if (S.auto) startCount();
  }
  return { start, ack, close, get running() { return !!S; } };
})();

/* ============================== VIEW ============================== */
if (typeof Router !== 'undefined') (function () {
  const HELP = [['112', 'Emergency', 'Police · Fire · Ambulance', true], ['14416', 'Tele-MANAS', 'Free mental-health counselling, 24x7, many languages', false], ['181', 'Women Helpline', 'Support for women in distress', false], ['14490', 'NCW Women Helpline', 'National Commission for Women, 24x7', false]];
  const telOf = n => 'tel:' + n.replace(/[^\d]/g, '');

  Router.register('sahara', async root => {
    const net = await Net.load(), hasLock = !Store.isOpen();
    root.innerHTML = `<div class="page">
      <div class="page-head"><div class="eyebrow">${icon('heart')} Sahara</div><h1>${t('sahara_title')}</h1><p class="lead">${t('sahara_sub')}</p></div>
      <div class="crisis-bar">${icon('alert')} In danger or thinking of ending your life right now? <a class="btn sm danger" href="tel:112">${icon('phone')} Call 112</a> <a class="btn sm" href="tel:14416">${icon('phone')} Tele-MANAS 14416</a> <button class="btn sm" id="sos-now">Get help now</button></div>
      <div class="split">
        <div class="card chat"><div class="chat-head"><img src="assets/sahara.svg" alt=""><div><b>Sahara</b><div class="small muted">Supportive companion · not a therapist, not a person</div></div></div>
          <div class="chat-log" id="log" aria-live="polite"></div>
          <form class="chat-in" id="cf"><input type="text" id="ci" placeholder="Write here…" autocomplete="off" aria-label="Message"><button class="btn primary" type="submit" aria-label="Send">${icon('send')}</button></form></div>
        <div class="stack">
          <div class="card"><div class="card-title"><span class="ic coral">${icon('phone')}</span>Talk to a real person</div><div class="stack">${HELP.map(([n, name, d, red]) => `<div class="hl ${red ? 'red' : ''}"><div><b>${n}</b><span><b>${name}</b> · ${d}</span></div><a class="btn sm ${red ? 'danger' : 'safe'}" href="${telOf(n)}">${icon('phone')} ${t('call')}</a></div>`).join('')}</div><p class="hint" style="margin-top:10px">${t('helpline_note')}. Last checked 8 Nov 2026 against PIB and NCW pages. Please confirm locally.</p></div>
          <div class="card"><div class="card-title"><span class="ic safe">${icon('heart')}</span>Calm down tools</div><div class="row"><button class="btn" id="b-breathe">Breathing</button><button class="btn" id="b-ground">5-4-3-2-1 grounding</button><button class="btn" id="b-plan">My safety plan</button></div></div>
          <div class="card ${net.circle.length && net.consent.alertCircle ? 'safe' : 'tint'}"><div class="card-title"><span class="ic">${icon('users')}</span>My safety net</div>
            ${hasLock ? '<p class="small">Unlock Kavach to use your trusted circle. Emergency numbers above always work.</p>' : `
            <div class="stack">${net.circle.length ? net.circle.map(c => `<div class="row spread"><span><b>${esc(c.name)}</b> <span class="hint">${esc(c.rel || '')} · ${esc(c.phone)}</span></span><button class="btn sm ghost" data-rm="${c.id}" aria-label="Remove">${icon('trash')}</button></div>`).join('') : '<p class="small muted" style="margin:0">Add people who should know if you are in danger.</p>'}
            <button class="btn sm" id="add-c">${icon('plus')} Add a trusted person</button></div>
            <hr style="border:0;border-top:1px solid var(--line);margin:14px 0"><div class="lbl" style="margin-bottom:8px">My choices (change any time)</div>
            <label class="chk"><input type="checkbox" id="c-circle" ${net.consent.alertCircle ? 'checked' : ''}><span>If I'm in danger, <b>alert my circle</b> with my location (I can cancel during a countdown).</span></label>
            <label class="chk" style="margin-top:8px"><input type="checkbox" id="c-112" ${net.consent.share112 ? 'checked' : ''}><span>If no one responds, <b>share my location and phone number with 112</b>.</span></label>
            <div class="field" style="margin-top:10px"><label for="c-share">What may be shared with 112 about our chat?</label><select id="c-share"><option value="none" ${net.consent.share === 'none' ? 'selected' : ''}>Nothing from the chat</option><option value="summary" ${net.consent.share === 'summary' ? 'selected' : ''}>A short risk summary (recommended)</option><option value="full" ${net.consent.share === 'full' ? 'selected' : ''}>The full conversation</option></select></div>
            <div class="grid g2"><div class="field"><label for="c-name">My name</label><input type="text" id="c-name" value="${esc(net.name)}"></div><div class="field"><label for="c-phone">My phone</label><input type="tel" id="c-phone" value="${esc(net.phone)}"></div></div>
            <p class="hint">Chats stay on this device and are never saved unless you choose. Nothing is shared automatically unless you turn it on here.</p>`}</div>
        </div></div></div>`;

    const log = $('#log');
    const bubble = (role, text) => { const d = document.createElement('div'); d.className = 'msg ' + role; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; Companion.transcript.push({ role: role === 'bot' ? 'sahara' : 'user', text, at: new Date().toISOString() }); };
    const quickRow = qs => { if (!qs || !qs.length) return; const r = document.createElement('div'); r.className = 'quick-r'; qs.forEach(q => { const b = document.createElement('button'); b.type = 'button'; b.textContent = q.l; b.onclick = () => { r.remove(); if (q.act) return act(q.act); bubble('user', q.l); respond(q.v || q.l); }; r.appendChild(b); }); log.appendChild(r); log.scrollTop = log.scrollHeight; };
    const typing = () => { const d = document.createElement('div'); d.className = 'typing'; d.innerHTML = '<i></i><i></i><i></i>'; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; };
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    async function act(a, level) {
      if (a === 'esc') return Escalation.start({ level: level || 2 });
      if (a === 'call14416') { location.href = 'tel:14416'; return; }
      if (a === 'circle') return net.circle.length ? Escalation.start({ force: 'circle', level: 2 }) : (toast('Add a trusted person first'), addPerson());
      if (a === 'plan') return openPlan();
      if (a === 'breathe') return openBreath();
      if (a === 'ground') return openGround();
      if (a === 'sos') { location.hash = '#/sos'; }
    }

    async function respond(text) {
      let res = Companion.reply(text);
      if (CONFIG.llmEndpoint && res.level === 0 && !Companion.state.awaiting && !/^__/.test(text) && !res.intent) {
        try { const r = await fetch(CONFIG.llmEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: Companion.transcript.slice(-12), risk: 0 }) }); const j = await r.json(); if (j.reply) res = { ...res, msgs: [j.reply] }; } catch {}
      }
      for (const m of res.msgs) { const ty = typing(); await sleep(500 + Math.min(900, m.length * 9)); ty.remove(); bubble('bot', m); }
      quickRow(res.quick);
      if (res.act) act(res.act, res.level);
    }

    $('#cf').onsubmit = e => { e.preventDefault(); const v = $('#ci').value.trim(); if (!v) return; $('#ci').value = ''; $$('.quick-r', log).forEach(x => x.remove()); bubble('user', v); respond(v); };
    $('#sos-now').onclick = () => Escalation.start({ level: 3 });
    $('#b-breathe').onclick = openBreath; $('#b-ground').onclick = openGround; $('#b-plan').onclick = openPlan;
    if (!hasLock) {
      $('#add-c').onclick = addPerson;
      $$('[data-rm]', root).forEach(b => b.onclick = async () => { net.circle = net.circle.filter(c => c.id !== b.dataset.rm); await Net.save(net); Router.render(); });
      const savePrefs = async () => { net.consent = { alertCircle: $('#c-circle').checked, share112: $('#c-112').checked, share: $('#c-share').value }; net.name = $('#c-name').value; net.phone = $('#c-phone').value; await Net.save(net); };
      ['c-circle', 'c-112', 'c-share'].forEach(id => $('#' + id).onchange = async () => { await savePrefs(); toast('Saved'); });
      ['c-name', 'c-phone'].forEach(id => $('#' + id).onchange = savePrefs);
    }
    if (!log.children.length) { bubble('bot', "Hi, I'm Sahara. I'm a supportive companion: not a therapist, and not a person. I can listen, help you through a hard moment, and connect you to real people any time."); bubble('bot', 'Nothing you write here is saved unless you choose. How are you feeling?'); quickRow([{ l: "I'm anxious", v: "I'm feeling anxious" }, { l: "I'm being blackmailed online", v: "Someone is blackmailing me with my photos" }, { l: 'I just need to talk', v: '__keep__' }]); }
  });

  function addPerson() {
    modal(`<div class="spread"><h2>Add a trusted person</h2><button class="btn sm ghost" data-close>${icon('x')}</button></div><p class="muted">Choose someone who would drop everything for you. They will only be contacted if you turn on alerts, or tap “Let my circle know”.</p>
      <div class="field"><label for="pn">Name</label><input type="text" id="pn"></div><div class="field"><label for="pr">Relationship</label><input type="text" id="pr" placeholder="Mother, friend, sister…"></div><div class="field"><label for="pp">Phone (with country code)</label><input type="tel" id="pp" placeholder="+91…"></div>
      <button class="btn primary block" id="ps">Save</button>`);
    $('#ps').onclick = async () => {
      const name = $('#pn').value.trim(), phone = $('#pp').value.trim(); if (!name || !phone) return toast('Name and phone are required', 'warn');
      const net = await Net.load(); net.circle.push({ id: uid(), name, rel: $('#pr').value.trim(), phone }); await Net.save(net); closeModal(); Router.render();
    };
  }

  async function openPlan() {
    const net = await Net.load(), p = net.plan || {};
    const F = [['warn', 'My warning signs (thoughts, feelings, situations)'], ['cope', 'Things I can do on my own to feel a little steadier'], ['people', 'People and places that help me feel okay'], ['ask', 'People I can ask for help'], ['safe', 'How I can make my space safer'], ['reasons', 'What matters to me / my reasons to keep going']];
    modal(`<div class="spread"><h2>My safety plan</h2><button class="btn sm ghost" data-close>${icon('x')}</button></div><p class="muted">Written while you are calm, for the moments you are not. Only you can see this.</p>
      ${F.map(([k, l]) => `<div class="field"><label for="sp-${k}">${l}</label><textarea id="sp-${k}" style="min-height:70px">${esc(p[k] || '')}</textarea></div>`).join('')}
      <div class="card danger" style="margin-bottom:12px"><b>If I can't keep myself safe:</b> I call <b>112</b> or <b>Tele-MANAS 14416</b>, or go to the nearest hospital.</div>
      <button class="btn primary block" id="sp-save">Save my plan</button>`);
    $('#sp-save').onclick = async () => { if (!Store.isOpen()) return toast('Unlock Kavach to save', 'warn'); net.plan = Object.fromEntries(F.map(([k]) => [k, $('#sp-' + k).value])); await Net.save(net); closeModal(); toast('Safety plan saved'); };
  }

  function openBreath() {
    modal(`<div class="spread"><h2>Breathe with me</h2><button class="btn sm ghost" data-close>${icon('x')}</button></div><p class="muted">Follow the circle. In through your nose, out slowly through your mouth. There is nothing to get right.</p>
      <div class="breath"><div class="orb" id="orb">Get ready</div></div><p class="center hint">A minute or two is enough.</p>`);
    const orb = $('#orb'); let alive = true; const steps = [['Breathe in…', 4000, true], ['Hold…', 2000, true], ['Breathe out slowly…', 6000, false]];
    (async () => { await new Promise(r => setTimeout(r, 900)); while (alive && $('#orb')) for (const [txt, ms, big] of steps) { if (!$('#orb')) { alive = false; break; } orb.textContent = txt; orb.classList.toggle('in', big); await new Promise(r => setTimeout(r, ms)); } })();
  }

  function openGround() {
    modal(`<div class="spread"><h2>5-4-3-2-1 grounding</h2><button class="btn sm ghost" data-close>${icon('x')}</button></div><p class="muted">This brings your mind back to the present. Say each one out loud or in your head, slowly.</p>
      <div class="steps"><div class="step"><div><h3>5 things you can see</h3><p>Look around and name them.</p></div></div><div class="step"><div><h3>4 things you can touch</h3><p>Your clothes, the chair, the floor under your feet.</p></div></div><div class="step"><div><h3>3 things you can hear</h3><p>Near and far.</p></div></div><div class="step"><div><h3>2 things you can smell</h3><p>Or two smells you like.</p></div></div><div class="step"><div><h3>1 thing you can taste</h3><p>Or one slow, deep breath.</p></div></div></div>`);
  }
})();

if (typeof module !== 'undefined') module.exports = { Risk, Companion };
