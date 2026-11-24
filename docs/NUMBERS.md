# Numbers 1–100

Open **Numbers 1–100** in the app navigation. This Malayalam–English course is available from either learning language and in the shared web app used by the desktop/mobile wrappers.

Use **Download the full list (CSV)** for a spreadsheet containing all 100 entries and glosses. Each entry shows decimal digits, Malayalam digits, English, Malayalam script, broad IPA, IAST with Malayalam extensions, a plain Roman pronunciation aid, and meaning glosses. Compound glosses separate the tens stem, optional joining `y` (`LINK`), and the unit. Irregular teens are glossed as complete words, rather than given an invented segmentation.

## Listening and recordings

The order is **Malayalam male → Malayalam female → English male → English female → next number**. Defaults are 0.7 seconds between voices, 1 second between languages, and 2 seconds between numbers. The last number has no trailing pause. Adjust these in playback settings; the between-number pause must remain longer than the other pauses. Settings and their last-save time stay on the current device.

- **Gemini service & saved recordings** uses the active Malayalam speech profile in Connections & models. It supports the authenticated Gemini gateway and direct Firebase AI Logic. Charon is the male voice; Kore is the female voice. Both read Malayalam and English. The selected model is preserved.
- **Play selected range** (or **Listen to…**) plays saved matching clips first and generates missing clips. Playback waits for each clip to finish before the pause starts.
- **Generate & save range** generates four clips per number (400 for the whole course), sequentially. Your provider's quota/billing applies. Existing matching clips are skipped, so restarting a stopped or failed range resumes it. Completed clips stay in IndexedDB.
- **Download WAV** combines saved clips in the displayed order and includes actual silence for the configured pauses. Each number has its own download; the range download combines multiple numbers. Generate the range first. Large exports are limited to 100 MB; choose a smaller range if necessary.
- **Export recordings ZIP** creates a Bhaasa audio backup with separate, labelled recordings. **Import recordings ZIP** restores matching number content, without replacing existing clips. Malayalam and English are stored separately. The ZIP retains provider, model, voice, gender, text, and recording origin.
- **Device voices** reads aloud without creating files. Select distinct male/female voices for each language after checking their sound; the app cannot reliably detect device voice gender. Some installed voices still need internet. Missing voices are reported explicitly.

Stop cancels the current playlist and pending gateway request. Navigating away, hiding the page, or pausing the native app also stops it. A direct Firebase SDK request already in flight may finish remotely; it is not saved or played after cancellation. Device settings and recordings are not synchronized across devices: export a backup before clearing browser data.

## Existing Firebase gateway: enable English

The older deployed gateway only allowed Malayalam and French. This revision adds English (`en`, `en-US`, `en-GB`, `en-IN`) and reports Charon/Kore alongside the configured Gemini voice. Direct Firebase AI Logic also uses the correct English reading prompt. Publishing GitHub Pages does **not** deploy Cloud Functions.

Use your existing authenticated Cloud Shell checkout and Firebase project. Keep your existing secrets and settings; do not initialize Firebase again. From the updated repository root:

```sh
git pull --ff-only origin main
npm run firebase:build
npm ci --prefix firebase/functions
cd firebase
npx --yes firebase-tools deploy --config "$PWD/firebase.json" --only functions:bhaasa --project bhaashik-apps
```

Use Node 22 for the existing Functions runtime. See [the gateway deployment and verification instructions](../firebase/README.md). After deployment, try **Listen to 1**. Check the two Malayalam voices and the two English voices, then generate a small range before the full list. An HTTP 400 on English with an older gateway displays an update instruction; already generated Malayalam recordings are retained. No provider credentials or gateway access codes are included in the static build or audio exports.

## Transcription conventions and sources

These are teaching transcriptions, not a claim of native-speaker validation. Regional and speaker variation is expected; review synthetic speech and IPA with a Malayalam speaker.

- Malayalam number words and the compound patterns follow [SMC's Malayalam morphology analyser: Cardinals](https://morph.smc.org.in/cardinals.html). We use the full linking variants consistently (`ഇരുപത്തിയൊന്ന്`); shorter variants such as `ഇരുപത്തൊന്ന്` are also common. We use `ഒമ്പത്`, `നാല്പത്`, and `എൺപത്` consistently; other established spellings exist.
- IAST is extended for Malayalam: `ḻ` represents ഴ, `ṟ` represents റ, and `ŭ` represents the reduced final vowel. The broad IPA uses `/ɯ/` for that vowel; actual realizations can be more central. IPA preserves vowel and consonant length, retroflex consonants, dental consonants, and the alveolar geminate in `റ്റ`.
- Plain Roman deliberately has no diacritics. `aa/ee/oo` indicate long vowels where used, `zh` approximates ഴ, and `th` represents a dental t/d sound, not the English sound in “thin”. It cannot encode all Malayalam contrasts; use IPA and audio for those.
- [Google's Gemini TTS voice documentation](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts) identifies Charon as male and Kore as female. These are synthetic voices, not human recordings.

The written course is included in the service-worker cache. Audio generated on a device is saved separately in IndexedDB; it is never uploaded to the repository automatically.
