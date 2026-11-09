'use strict';
/* Pure-logic tests. Run: node tests/logic.test.js  (no dependencies) */
global.Router = { register() {}, onChange: null };           // stub: views register themselves at load
global.icon = () => ''; global.$ = () => null; global.$$ = () => [];
const path = require('path'), { Legal } = require(path.join(__dirname, '../js/report.js'));
const { Risk, Companion } = require(path.join(__dirname, '../js/sahara.js'));

let pass = 0, fail = 0;
const t = (name, cond) => { cond ? pass++ : (fail++, console.log('FAIL', name)); };

/* ---- crisis detection: it is better to over-flag than to miss ---- */
const lvl = s => Risk.assess(s).level;
t('plain ideation -> 2', lvl('I want to die') === 2);
t('ideation + means -> 3', lvl('I want to die, I have pills with me') === 3);
t('"kill myself" -> >=2', lvl('I am going to kill myself tonight') >= 2);
t('suicide word -> >=2', lvl('I keep thinking about suicide') >= 2);
t('Hindi (Devanagari) -> >=2', lvl('मैं आत्महत्या करना चाहती हूँ') >= 2);
t('Hinglish -> >=2', lvl('main marna chahti hoon') >= 2);
t('passive -> 1', lvl("I can't go on like this, I'm such a burden") === 1);
t('"better off dead" -> >=2', lvl('everyone would be better off dead without me, I wish I was dead') >= 2);
t('benign small-talk -> 0', lvl('hello, how is your day') === 0);
t('"killing me" (idiom) not flagged', lvl('this deadline is killing me') === 0);
t('harassment text alone -> 0', lvl('he is sending me vulgar messages every day') === 0);
t('empty/undefined safe', lvl('') === 0 && lvl(undefined) === 0);

/* ---- companion dialogue ---- */
Companion.reset();
let r = Companion.reply('I want to die');
t('ideation -> safety check with 3 quick replies', r.level === 2 && r.quick.length === 3 && !r.act);
r = Companion.reply('__safe__');
t('"safe" -> offers Tele-MANAS, circle, safety plan', r.quick.some(q => q.act === 'call14416') && r.quick.some(q => q.act === 'circle') && r.quick.some(q => q.act === 'plan'));
Companion.reset(); Companion.reply('I want to die'); r = Companion.reply('__danger__');
t('"danger" -> immediate escalation', r.act === 'esc' && r.level === 3);
Companion.reset(); r = Companion.reply('I want to die, I have pills');
t('means+intent -> immediate escalation', r.act === 'esc' && r.level === 3);
Companion.reset(); Companion.reply('I want to die'); r = Companion.reply("I'm not safe, I will do it");
t('free-text "not safe" -> escalation', r.act === 'esc');
Companion.reset(); r = Companion.reply("I can't go on, I'm so tired of everything");
t('passive -> asks directly about suicide', /thoughts of ending your life/.test(r.msgs.join(' ')) && r.quick.length === 3);
r = Companion.reply('__no__');
t('"no, just exhausted" -> stays supportive, no escalation', !r.act && r.level === 1);
Companion.reset(); r = Companion.reply('Someone is blackmailing me with my photos');
t('blackmail -> offers emergency guide', r.quick.some(q => q.act === 'sos'));
Companion.reset(); r = Companion.reply("I'm so anxious I can't breathe");
t('anxiety -> breathing / grounding offered', r.quick.some(q => q.act === 'breathe'));
Companion.reset(); r = Companion.reply('he beats me');
t('abuse disclosure -> safety question', /safe at this moment/i.test(r.msgs.join(' ')));
Companion.reset(); r = Companion.reply('asdf qwerty');
t('unknown text -> gentle fallback (never an error)', r.msgs.length === 1);
Companion.reset(); r = Companion.reply('I want to die'); const m1 = r.msgs.join(' ');
t('never promises secrecy or claims to be human/clinician', !/(i promise|i am a (doctor|therapist|human)|confidential(ly)? between us)/i.test(m1));

/* ---- legal analyzer ---- */
let a = Legal.analyze('He has my private photos and says he will send them to my family unless I pay Rs 15000 by tonight');
t('sextortion detected & critical', a.found[0].key === 'sextortion' && a.urgency === 'critical');
t('sextortion cites BNS 308', a.found[0].secs.some(s => /BNS s\.308/.test(s)));
t('threat-only message is NOT misclassified as NCII', !a.found.some(f => f.key === 'nci'));
a = Legal.analyze('Someone made a fake account using my photos and my name');
t('impersonation detected', a.found.some(f => f.key === 'impersonation'));
a = Legal.analyze('my morphed photo is circulating, it is a deepfake');
t('deepfake detected', a.found.some(f => f.key === 'deepfake'));
a = Legal.analyze('my nude photos were leaked and posted on a telegram group');
t('NCII detected when published', a.found.some(f => f.key === 'nci') && a.urgency === 'high');
a = Legal.analyze('he keeps messaging me from new accounts and wont stop');
t('stalking detected', a.found.some(f => f.key === 'stalking'));
a = Legal.analyze('I had a lovely day at the park');
t('benign text -> nothing flagged', a.found.length === 0);
const c = Legal.buildComplaint({ type: 'sextortion', name: 'Asha', platform: 'Instagram', handle: '@x', desc: 'threats', evidence: [{ platform: 'Instagram', handle: '@x', createdAt: 't', files: [{ name: 'a.png', sha256: 'abc' }] }] });
t('complaint includes name, evidence hash, sections, disclaimer-free facts', /Asha/.test(c) && /SHA-256 abc/.test(c) && /BNS s\.308/.test(c) && /FIR/.test(c));
t('takedown cites 24-hour rule for intimate content', /24 hours/.test(Legal.buildTakedown({ type: 'nci', platform: 'Instagram' })));
t('takedown for harassment does not misquote the intimate-image rule', !/Rule 3\(2\)\(b\)/.test(Legal.buildTakedown({ type: 'harassment', platform: 'X (Twitter)' })));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
