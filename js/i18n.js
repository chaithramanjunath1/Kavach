'use strict';
/* English + Hindi for the surfaces a woman in distress sees first. Missing keys fall back to English. */

const I18N = {
  en: {
    nav_home: 'Home', nav_sos: 'Emergency', nav_shield: 'Image Shield', nav_vault: 'Evidence Vault', nav_report: 'Report & Takedown', nav_sahara: 'Sahara · Talk', nav_help: 'Helplines & Rights', nav_about: 'About Kavach',
    tagline: 'Her image. Her evidence. Her call.',
    brand_sub: 'Armor for the online world',
    hero_title: 'Your armor in the online world.',
    hero_sub: 'Stop your photos from being misused, keep tamper-proof evidence, file a complaint that gets taken seriously, and talk to someone when it feels like too much. Everything stays on your phone, under your control.',
    cta_sos: 'I need help right now', cta_shield: 'Protect a photo', cta_talk: 'Talk to someone',
    quick_exit: 'Quick exit', disguise: 'Disguise app', disguise_on: 'Disguised as “Daily Notes”', lang: 'Language',
    qa_shield: 'Image Shield', qa_shield_d: 'Fingerprint a photo on your device so copies can be blocked.',
    qa_vault: 'Evidence Vault', qa_vault_d: 'Encrypted, hash-chained proof that stands up in court.',
    qa_report: 'Report & Takedown', qa_report_d: 'Complaint letter, platform takedown, case tracker.',
    qa_sahara: 'Sahara', qa_sahara_d: 'A caring companion and real helplines, any hour.',
    sos_title: 'You are not alone. This is not your fault.',
    sos_sub: 'Take a breath. Here is exactly what to do, in order. You do not need to do it all at once.',
    sos_1: 'Do not pay', sos_1d: 'Paying almost never stops the threats. It usually makes them grow.',
    sos_2: 'Do not delete anything', sos_2d: 'Chats, profiles, numbers and payment requests are evidence. Save them first.',
    sos_3: 'Stop replying', sos_3d: 'You can block them after you have saved the evidence.',
    sos_4: 'Secure your accounts', sos_4d: 'Change passwords, turn on 2-step verification, make profiles private.',
    sos_5: 'Report it', sos_5d: 'Call 1930 or file at cybercrime.gov.in. You can do this online, from home.',
    sahara_title: 'You do not have to carry this alone.',
    sahara_sub: 'Talk to Sahara, call a trained counsellor, or let someone you trust know. Free and private.',
    helpline_note: 'Free, confidential, 24x7',
    call: 'Call', open: 'Open',
    mood_q: 'How are you feeling today?',
    privacy_h: 'Privacy by design',
  },
  hi: {
    nav_home: 'होम', nav_sos: 'आपातकाल', nav_shield: 'इमेज शील्ड', nav_vault: 'सबूत तिजोरी', nav_report: 'रिपोर्ट व टेकडाउन', nav_sahara: 'सहारा · बात करें', nav_help: 'हेल्पलाइन व अधिकार', nav_about: 'कवच के बारे में',
    tagline: 'उसकी तस्वीर. उसके सबूत. उसका फ़ैसला.',
    brand_sub: 'ऑनलाइन दुनिया का कवच',
    hero_title: 'ऑनलाइन दुनिया में आपका कवच।',
    hero_sub: 'अपनी तस्वीरों का दुरुपयोग रोकें, सबूत सुरक्षित रखें, ऐसी शिकायत तैयार करें जिसे गंभीरता से लिया जाए, और जब सब भारी लगे तो किसी से बात करें। सब कुछ आपके फ़ोन में, आपके नियंत्रण में।',
    cta_sos: 'मुझे अभी मदद चाहिए', cta_shield: 'तस्वीर सुरक्षित करें', cta_talk: 'किसी से बात करें',
    quick_exit: 'तुरंत बाहर निकलें', disguise: 'ऐप छिपाएँ', disguise_on: '“Daily Notes” के रूप में छिपा', lang: 'भाषा',
    qa_shield: 'इमेज शील्ड', qa_shield_d: 'अपने फ़ोन पर तस्वीर की फ़िंगरप्रिंट बनाएँ ताकि उसकी कॉपी रोकी जा सके।',
    qa_vault: 'सबूत तिजोरी', qa_vault_d: 'एन्क्रिप्टेड, हैश-चेन वाले सबूत जो अदालत में टिकें।',
    qa_report: 'रिपोर्ट व टेकडाउन', qa_report_d: 'शिकायत पत्र, प्लेटफ़ॉर्म टेकडाउन, केस ट्रैकर।',
    qa_sahara: 'सहारा', qa_sahara_d: 'हर समय एक संवेदनशील साथी और असली हेल्पलाइन।',
    sos_title: 'आप अकेली नहीं हैं। यह आपकी गलती नहीं है।',
    sos_sub: 'एक गहरी साँस लें। यह रहा क्रम से क्या करना है। सब एक साथ करना ज़रूरी नहीं।',
    sos_1: 'पैसे न दें', sos_1d: 'पैसे देने से धमकियाँ लगभग कभी नहीं रुकतीं, अक्सर बढ़ जाती हैं।',
    sos_2: 'कुछ भी डिलीट न करें', sos_2d: 'चैट, प्रोफ़ाइल, नंबर और पैसे की माँग सबूत हैं। पहले उन्हें सुरक्षित करें।',
    sos_3: 'जवाब देना बंद करें', sos_3d: 'सबूत सुरक्षित करने के बाद आप उन्हें ब्लॉक कर सकती हैं।',
    sos_4: 'अपने अकाउंट सुरक्षित करें', sos_4d: 'पासवर्ड बदलें, 2-स्टेप वेरिफ़िकेशन चालू करें, प्रोफ़ाइल प्राइवेट करें।',
    sos_5: 'शिकायत दर्ज करें', sos_5d: '1930 पर कॉल करें या cybercrime.gov.in पर शिकायत करें। यह घर बैठे ऑनलाइन हो सकता है।',
    sahara_title: 'आपको यह अकेले नहीं उठाना है।',
    sahara_sub: 'सहारा से बात करें, प्रशिक्षित काउंसलर को कॉल करें, या किसी भरोसेमंद को बताएँ। मुफ़्त और निजी।',
    helpline_note: 'मुफ़्त, गोपनीय, 24x7',
    call: 'कॉल करें', open: 'खोलें',
    mood_q: 'आज आप कैसा महसूस कर रही हैं?',
    privacy_h: 'डिज़ाइन से ही निजता',
  },
};

let LANG = (() => { try { return localStorage.getItem('kv_lang') || 'en'; } catch { return 'en'; } })();
const t = k => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
function setLang(l) {
  LANG = l;
  try { localStorage.setItem('kv_lang', l); } catch {}
  document.documentElement.lang = l;
  if (window.App) App.refresh();
}
