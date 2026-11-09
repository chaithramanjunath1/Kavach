# Kavach — Her image. Her evidence. Her call.

**Digital-safety armor for women, built for HERHACK 2026 (AI track · Women Safety award).**

Online abuse (sextortion, morphed images, impersonation, stalking) is a problem with five different systems and no front door. A woman in crisis juggles screenshots, platform report forms, a police portal, and her own panic. Kavach is one private place that **protects** her images, **preserves** her evidence, **walks her through** a complaint, and **stays with her** if it becomes too much.

> **No server. No account. No tracking.** Everything runs and is stored on her own device, encrypted.

---

## What it does

| Module | What it does | Real or simulated? |
|---|---|---|
| **Image Shield** | Computes a 64-bit perceptual hash (DCT pHash) of a photo **on the device**. Only the fingerprint is kept, never the photo. A platform holding it can block re-uploads, including resized, recompressed, brightened, mirrored, watermarked and black-and-white copies. | Hashing and matching are **real**. The "MockGram" platform that consumes it is a **demo**. |
| **Photo forensics** | EXIF/GPS reader, Error Level Analysis, metadata-stripping privacy cleaner. | **Real**. ELA is a weak hint, **not** a deepfake detector, and the UI says so. |
| **Evidence Vault** | Append-only, SHA-256 **hash-chained**, AES-256-GCM encrypted. Editing any past entry breaks the chain and is flagged. Links repeat incidents by the same handle. Exports a printable court-ready report with a **BSA s.63** certificate template. | **Real** |
| **Report & Takedown** | Explains what is happening (explainable rules, on-device), drafts the cyber-cell complaint with indicative BNS / IT Act provisions, drafts a platform takedown citing the 24-hour rule (IT Rules 2021, r.3(2)(b)), and tracks deadlines per case. | **Real** drafting. Legal mappings are **indicative**; see Limits. |
| **Emergency guide** | The five things to do in a sextortion / blackmail situation, one tap to 112 and 1930. | **Real** |
| **Sahara** | A supportive companion with on-device crisis detection (English, Hindi, Hinglish), breathing and grounding tools, a safety plan, helplines, and a **consent-based safety net** (see below). | Companion is **rule-based**. Alerts run in **simulation mode** unless a relay is configured. |
| **Safety touches** | Quick exit (button or Esc Esc), disguise mode ("Daily Notes"), English + Hindi, offline PWA, passphrase lock. | **Real** |

### Sahara's safety net, designed around consent

The woman configures this while calm, in *Sahara → My safety net*:

1. She adds **trusted people**.
2. She chooses whether to **alert her circle** if she is in danger, and whether to **share location and phone with 112** if no one responds.
3. She chooses what of the chat may be shared: **nothing**, a **short risk summary** (default), or the **full conversation**.

When Sahara detects imminent risk it shows a **countdown she can cancel**, alerts her circle with her location, waits for someone to respond, and only then prepares the 112 package. She can also tap *Get help now* at any time. 112, Tele-MANAS 14416 and her contacts are always one tap away.

**Why not send everything silently?** Women stop being honest with a companion they believe is reporting on them, and false alarms burden emergency services. Consent and a cancel window keep her in control while still getting help to her.

---

## Run it

No build step.

```bash
cd kavach
python3 -m http.server 8000      # or: npx serve
# open http://localhost:8000
```

Or open **`kavach-standalone.html`** (everything inlined) directly in Chrome.

Choose a passphrase, or use *Try the demo without a passphrase*.

### Demo path (3 minutes)

1. **Home:** the one-door story.
2. **Image Shield → Protect → "Use a sample photo"**, then **Test the shield → Generate attacker edits**. Click each edit: all are blocked, the *different* photo is allowed, and a heavy crop is held for human review.
3. **Evidence Vault:** add two entries from the same handle. Open the integrity bar and the "same person" pattern. In the console, edit an entry to see **"Chain broken"**. Export the report.
4. **Report & Takedown:** paste a blackmail message. Read the assessment, then draft the complaint.
5. **Sahara:** add a trusted person, turn on the safety net, type *"I want to die, I have pills"*, and watch the countdown, circle alert and 112 package (clearly labelled **SIMULATION**).

---

## Architecture

```
index.html ─ css/styles.css
js/util.js       helpers + tiny serialised hash router
js/i18n.js       English / Hindi strings
js/store.js      IndexedDB + AES-256-GCM (PBKDF2-SHA256, 250k iterations)
js/forensics.js  EXIF parser, Error Level Analysis, metadata cleaner
js/shield.js     DCT pHash, matching, attacker-edit generator, views
js/vault.js      hash-chained evidence, verification, report export, views
js/report.js     incident analyzer, legal mapping, complaint + takedown, case tracker
js/sahara.js     risk detection, companion, escalation ladder, safety net, views
js/app.js        lock/onboarding, navigation, quick exit, disguise, home/SOS/help/about
sw.js, manifest.json    offline PWA
tests/logic.test.js     35 logic tests (node, zero dependencies)
```

Matching rule: Hamming distance ≤ 10 of 64 bits is **blocked**, ≤ 16 is **held for human review**, otherwise allowed. A second, mirrored fingerprint is stored so flipped copies are caught.

### Privacy and security model

- Photos are **never uploaded or stored**. Only a 64-bit fingerprint and a label you choose.
- Vault data is **AES-256-GCM encrypted**; the key comes from the passphrase (PBKDF2). **It cannot be recovered if forgotten.** There is a wipe option.
- *Demo mode* (no passphrase) keeps a random key beside the data, which only deters casual snooping.
- Service worker caches only the app shell, never user data.
- Pressing **Quick exit** clears the screen, locks the vault and navigates to an innocuous page.

---

## Limits (please read)

These are stated in the app's *About* page too.

- **Blocking across platforms needs partners.** The shield demonstrates the mechanism end to end on a mock platform. Real impact needs a trusted registry such as [StopNCII.org](https://stopncii.org) and platform adoption. A 64-bit pHash is also easier to evade than the larger hashes used in production systems.
- **A browser cannot silently send SMS or reach 112.** Real delivery needs a server relay and an ERSS-112 / telecom partnership. Until `CONFIG.alertEndpoint` is set the app runs in **simulation mode** (clearly labelled) or hands the user one-tap Call / SMS / WhatsApp buttons. It never claims help was dispatched when it was not.
- **ELA is not a deepfake detector.** Modern fakes pass it and honest photos can fail it.
- **Sahara is rule-based**, a companion rather than a clinician. Crisis detection runs locally and errs toward flagging. Idioms such as "I could die laughing" will trigger a safety check, which is a deliberate trade-off. A clinician-reviewed model and evaluation are required before any real deployment.
- **Legal output is indicative, not legal advice.** The police decide the sections; a lawyer should review. Provisions referenced: IT Act ss.66C, 66D, 66E, 67, 67A; BNS ss.75, 77, 78, 79, 308, 319, 351, 356; BSA s.63.
- **Helplines** were last checked on 8 Nov 2026 against PIB and NCW pages (112, 1930, 14416 / 1800-89-14416, 181, 14490, 1098). Please confirm locally before any deployment.

### Wiring the real alert relay

Set in `js/sahara.js`:

```js
CONFIG.alertEndpoint = 'https://your-relay.example/alert'
```

The app will `POST { kind: 'circle' | '112', payload }` where the payload contains `person`, `location` (`lat`, `lon`, `accuracy_m`, `map`), `risk`, and, per her consent, `summary` or `transcript`. The relay is responsible for SMS/WhatsApp delivery and for any authorised hand-off to emergency services. Set `CONFIG.llmEndpoint` (`POST {messages, risk}` → `{reply}`) to let a hosted LLM write replies for **non-crisis** turns; crisis detection always runs locally first and never depends on the network.

---

## Roadmap

Pilot with a college ICC and a women's NGO → submit hashes to StopNCII with consent → consent-based alert relay and 112 integration → clinician-reviewed Sahara and more Indian languages → larger perceptual hashes (PDQ) and server-side registry for platforms.

## Tests

```bash
node tests/logic.test.js        # 35 tests: crisis detection, dialogue flow, legal analyzer
```

The end-to-end browser flow (onboarding → shield → vault tamper detection → report → escalation → mobile layout) was also verified with Playwright.

## Team

_Add team member details here before submission._

---

*Kavach is a self-help tool. It is not a law firm, a clinician, or an emergency service. In immediate danger, call **112**.*
