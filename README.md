# Bhaasa · Sounds, scripts, and everyday language

**Current source and web app: v0.7.2.** The `main` branch includes the iPad Connections & models fixes. [Open the current web app](https://bhaashik.github.io/LanguageLearning/) or run/build this checkout from source. The source version is recorded in [package.json](package.json).

## Downloadable test builds — v0.7.1

The prebuilt packages below are still **v0.7.1**. They were uploaded before the v0.7.2 source/web update and have not been rebuilt with its new connection controls. Their version labels describe the downloaded files; they do not describe the current `main` checkout.

| Platform | Download | Testing requirements |
| --- | --- | --- |
| Linux x64 | [Portable archive (42 MB)](https://github.com/bhaashik/LanguageLearning/raw/refs/heads/linux-downloads/v0.7.1/Bhaasa-linux-x64.tar.gz) · [Checksum and instructions](https://github.com/bhaashik/LanguageLearning/tree/linux-downloads) | Extract and run Bhaasa; installed browser required, no separate Node.js installation needed. |
| Windows x64 | [Portable ZIP](https://github.com/bhaashik/LanguageLearning/raw/refs/heads/windows-downloads/v0.7.1/Bhaasa-windows-x64.zip) · [Checksum and instructions](https://github.com/bhaashik/LanguageLearning/tree/windows-downloads) | Windows 10+, installed browser; extract before opening Start Bhaasa.vbs or Bhaasa.exe. |
| Android | [Test APK](https://github.com/bhaashik/LanguageLearning/raw/refs/heads/android-downloads/v0.7.1/Bhaasa-Android-debug.apk) · [Checksum and instructions](https://github.com/bhaashik/LanguageLearning/tree/android-downloads) | Android 7.0+, updated WebView; allow installation from the download source. Debug-signed for testing. |
| iPhone/iPad signing archive | [Unsigned archive ZIP](https://github.com/bhaashik/LanguageLearning/raw/refs/heads/ios-downloads/v0.7.1/Bhaasa-iOS-unsigned.xcarchive.zip) · [Checksum and instructions](https://github.com/bhaashik/LanguageLearning/tree/ios-downloads) | Compiled ARM64 device archive for Apple signing in Xcode. It cannot be installed directly; device testing needs your signing identity or TestFlight. |

The **Publish test packages** GitHub Actions workflow builds Windows and the unsigned iPhone/iPad archive on native runners and publishes checked files to their download branches. Its manual run also supports rebuilding Android. Each download page includes build status, the source commit, instructions, and SHA-256 checksums once ready. These downloads remain available independently of Actions artifact retention.

Bhaasa teaches Malayalam and French. The Malayalam foundation started from the two learning guides supplied for this project. The core app is static HTML, CSS, and JavaScript with no runtime packages or backend requirement. Progress and recordings stay on the learner’s device. New speech generation is optional and can use a separately connected service.

## Run

The web app's **Connections & models** page provides selectable OCR, TTS, and ASR models and TTS voices. GitHub Pages starts without pretend API URLs; cloud services need a separate reachable HTTPS gateway, while device voices/recordings and tracing can work without one. [iPad/web gateway setup](docs/PROVIDERS.html#ipad-web) explains the three independent checks and CORS origin settings. This browser's settings do not transfer from a desktop automatically.

With Node.js 20.12+ (Node 24 recommended), from the cloned repository directory:

```sh
node -p "require('./package.json').version"
npm run dev
```

The development server uses port 4173 (`PORT` overrides it). Any static HTTP server also serves the core app; HTTPS or localhost is required for installation, offline caching, and microphone access. Do not open `index.html` through `file://`.

## Constructions, speaking, and spaced reviews
+
+Choose **Malayalam** or **French** in the language selector. Each language retains its own progress, recap, reviews, voice preferences, and audio collection. Malayalam includes its existing script/tracing course; French adds the Latin alphabet, accent marks/ligatures, starter vocabulary, phrases, and six sound topics.
+
+**Useful constructions** has 16 units and 32 model sentences per language. Units cover function words, pronoun/noun case or gender, inflections, agreement constraints, questions, negation, requests, tense, clitics/relatives, and simple conditions. Examples include Roman/Latin spelling, broad IPA, approximate extended Devanagari, and explicit glosses. Construction exercises have complete answer keys and no tracing/OCR.
+
+**Speak & listen** reuses the audio library for model TTS. ASR can use browser recognition, OpenAI transcription, Gemini audio input, a local Whisper-compatible service, or a custom adapter. Gateway recordings are submitted only by an explicit check; the expected phrase is never sent. Results show transcripts and word overlap, not a pronunciation/fluency grade. French silent agreement endings still need written practice. Microphone recording/import, recording playback/saving, cancellation, and native app pause are supported.
+
+Recall and speaking have separate review queues: successful due reviews advance through **1, 3, 7, 14, 30 days**. Misses return now; early correct practice does not push the schedule forward. Progress exports include speaking history and the learning language; audio exports remain separate and use `malayalam/` or `french/` folder roots. Existing Malayalam progress/audio identities remain compatible. Switch to the matching language before importing its backup.
+
+The offline [speech and review guide](docs/SPEAKING.html) explains provider variables, privacy, microphone support, language behavior, and scheduling. The local web server loads `.env.local`; the desktop package reads `providers.env`. New `BHAASA_ASR_<PROVIDER>_API_KEY`, `_MODEL(S)`, and `_URL` settings are independent of OCR/TTS. Paid account access, recognition quality, and native pronunciation still require real-service/teacher review.
+
+## Linux and Windows desktop
+
+The portable desktop package uses an installed browser and includes the local OCR/TTS gateway. Chrome/Edge/Chromium/Brave open an app window; Firefox and the explicit system-default option open a normal window. No hosting or separate Node installation is needed for packaged builds. Provider keys stay in a private `providers.env` file outside the executable.
+
+```sh
+# Source development and packaging require Node 24
+npm run desktop:install
+npm run desktop:start
+npm run desktop:package
+```
+
+See the [desktop setup guide](docs/DESKTOP.html) for portable Linux/Windows packages, browser selection, API setup, profiles/backups, and the manual **Build desktop apps** GitHub Actions workflow. Default address: `http://127.0.0.1:4174/`; browser/profile/port changes use separate progress stores, so export progress and audio before switching.
+
+## Android and iOS

Bhaasa includes Capacitor projects for Android and iOS. Lessons, tracing, progress, and saved audio are packaged on the device, with native voices for the selected language and file sharing. No hosting is needed for the core app. Cloud OCR/TTS require a separately reachable HTTPS gateway; your computer's `127.0.0.1` address will not work on a phone.

```sh
# Node 24; install mobile dependencies once
npm run mobile:install
npm run mobile:android  # Android Studio, JDK 21, SDK 36
# On macOS with Xcode:
npm run mobile:ios
```

See the [mobile setup guide](docs/MOBILE.html) for APK builds, iPhone signing, gateway settings, moving browser progress/audio, and the manual GitHub Actions mobile build. Android requires 7.0+ with an updated WebView; iOS requires 16.4+. Native device behavior still needs real-phone testing. The regular web build has no new dependencies.

## In-app tester feedback with Google Sheets

**Give feedback** has selectable feature results, ease-of-use and problem choices, plus optional notes. Drafts and reports save locally, work offline, and can be exported/shared. An optional Google Apps Script deployment writes responses to a private Google Sheet. No separate server or Google sign-in for testers is needed.

Use the [collector template](feedback-apps-script/) and [step-by-step setup guide](docs/FEEDBACK.html). The Sheet owner deploys it under their Google account, then supplies the public `/exec` URL through feedback settings or `feedback-config.js` before building a release. No collector is preconfigured. Bhaasa waits for a verified receipt before displaying confirmed submission; retries deduplicate the same report ID. Confirm live delivery on your own Sheet and phones before distribution.

## Learning workflow

- Ten Malayalam foundation lessons, sixteen additional construction lessons, and an unrestricted Malayalam script reference: 16 vowels, 36 consonants, 14 vowel-sign examples, 6 chillus, and 32 conjuncts. The Syllables builder covers 952 base/pattern combinations, including vowel-marked conjuncts.
- Script examples use actual words for common symbols. Three rare learned vocalic vowels and rare chillu ൿ have explicit teaching examples/alternative-spelling notes rather than invented everyday words.
- 66 everyday words, 10 phrases, additional sound-example vocabulary, six grammar patterns, and a six-part **Sounds of Malayalam (Phonetics & Phonology)** section.
- Roman spelling, broad IPA, extended Devanagari, and simplified morpheme glosses are available in expandable details on learning cards, script examples, grammar examples, recap, and answer feedback. Letters/syllables are labelled as sound units, not morphemes. Joined word forms can differ from their segmented analysis.
- Every writing form also has phonetic feature labels and a one- or two-sentence pronunciation tip. Vowels show height, front/back position, rounding, and length; consonants show place, manner, voicing, and aspiration where relevant. Conjuncts and syllables list their component sounds separately. **Sounds of Malayalam** includes a browsable feature reference and a short glossary of the labels.
- Curved tracing for all 104 reference entries and 871 additional syllable forms, with numbered starts, direction arrows, an animated demonstration, guide hiding, undo/clear, and pen/finger/mouse input. Offline checks cover guide fit, separate marks, smoothness, pen lifts, and following the suggested path. Optional handwriting recognition supports OpenAI, Gemini, Claude, local compatible vision models, and custom OCR endpoints; generated practice paths are not teacher-verified Malayalam stroke order.
- Recognition, grammar, and sound-pattern exercises. Every exercise ends with its complete answer key, including the learner’s answers and explanatory detail.
- Separate colored accuracy bars for writing-system recognition, phonetics, words, phrases, and grammar, both **this session** and **overall**. Scores measure answered questions, not proficiency or freehand writing quality.
- Automatic return to the last page/card or unfinished exercise when opening the base address, plus a brief recap. An explicit link to any section always works. Already answered quiz questions do not score twice after reload.
- Sessions survive reloads, restart after 30 minutes without interaction, and can be restarted explicitly without erasing overall results.
- Drawing drafts, tracing results, and OCR outcomes are saved separately from reading quizzes and included in progress backups. Reopening an unchanged drawing does not add another tracing score or silently repeat a paid OCR call.
- Progress JSON backup/import, including migration from the original Aksharam progress format. Progress is local to this origin/browser, not synchronized across devices.

Content details and limitations are in [docs/CONTENT.md](docs/CONTENT.md). Word/sentence IPA is a broad **spelling-based approximation**, not a verified narrow transcription of natural speech. Extended Devanagari is comparative script correspondence, not ordinary Hindi pronunciation. A Malayalam teacher’s review and native-speaker recordings are still needed for a finished curriculum.

The [OCR & speech setup guide](docs/PROVIDERS.html) covers OpenAI, Gemini, Claude, ElevenLabs, local vision engines, and custom OCR/TTS adapters, with environment examples, field mappings, recording/import workflows, and troubleshooting. Open it from About, the tracing settings, or Voices & recordings. The readable/printable HTML document is included in the static build and cached for offline reading.

## Curved tracing and handwriting recognition

Open **Writing system**, choose a symbol, and use **Trace. Flow. Remember.**

1. **Watch the strokes** animates the guide; numbered dots and arrows show its suggested order/direction.
2. Trace the curves with a mouse, pen, or finger. The pad smooths the visible ink while retaining separate pen-down strokes.
3. **Check my tracing** runs offline. It reports guide fit, coverage of each separate part, smoothness, pen-lift count, and suggested path following. Blank taps, missing vowel signs, off-path scribbles, and excessive retracing do not receive a good tracing result.
4. Hide **Show guide** and try the shape from memory. A shape can fit while using a different stroke order: those results are reported separately rather than declaring every alternate path a wrong letter.
5. Choose a **Handwriting recognition** provider and click **Recognize my handwriting**. This sends a cropped black-on-white image of only your ink to the selected gateway. Neither the printed guide, demonstration, markers, expected symbol, nor its ID is sent to the model. The gateway transcribes first; the browser then compares the reading with the target. Unreadable/uncertain results are separate from incorrect readings. Recognition can still be wrong and is not handwriting certification.

The provider menu offers **OpenAI**, **Google Gemini**, **Anthropic Claude**, **Local / OpenAI-compatible vision model**, **Custom OCR endpoint**, and **Off · tracing only**. OCR selection is independent of speech voices. Each provider remembers its model and endpoint in this browser. Changing providers keeps the drawing and tracing result. Up to 20 source-tagged readings per symbol are retained in progress backups; an unchanged drawing with the same provider, endpoint, and model reuses its saved reading. To regenerate it, check **Request a fresh reading** in the connection settings. This is also needed when changing the server's default model without changing the browser settings. Failed requests do not add a judged result or trigger a fallback to another provider.

Touchscreens work through Pointer Events: draw with a finger or stylus on the pad, and scroll outside it. Continuous native touch input is covered by Chromium browser tests. Device-specific stylus features and palm rejection depend on the browser/device.

If **Check my tracing** is greyed out, read the status directly below the buttons. Draw a full-size symbol over the pale guide and release your finger, pen, or mouse button. A tap, short line, or the animated demonstration alone does not count as a completed drawing. If the practice guide could not load, use **Retry loading practice guide**; retrying keeps your ink. This check works without an API key or OCR gateway, including with **Off · tracing only** selected.

The bundled guides are centerlines derived from **Noto Sans Malayalam Regular**. The original 84 guides are preserved; the expanded set of 975 guides has 77 one-stroke, 591 two-stroke, 247 three-stroke, 51 four-stroke, and 9 five-stroke suggestions. A connected route can retrace a short segment. These are font-based practice suggestions, not a researched account of conventional Malayalam handwriting. **A Malayalam teacher should verify or replace them before they are described as correct stroke order.** Detached signs are kept separate rather than forcing every symbol into one or two strokes.

Use **Writing system → Conjuncts** for clusters such as മ്മ, ണ്ണ, ക്ര, and പ്ര. **Writing system → Syllables** combines the 36 consonants and 32 conjuncts with the 14 vowel/sign patterns. Its preview and all-pattern grid open the normal tracing/OCR pad. Existing forms reuse their original IDs; new forms have independent drafts, scores, recordings, and backups. The builder restores its selected base and pattern after reopening. Constructed forms are sound units, not necessarily vocabulary; example words are shown only where the course supplies them.

Under **Teacher guides, OCR connection & exports**, export your strokes as Bhaasa JSON, or import an instructor's stroke-guide JSON for the same symbol. Imported paths are labelled custom guides and can be replaced with **Use font guide**. Export/import does not establish that a guide is linguistically correct. Custom guides and current drawing drafts are kept in progress backups.

### Run OCR on your computer

The OCR gateway is part of the same local server; no new runtime dependency is needed. Configure one or more providers in `.env.local`. Keys stay on that server; do not enter API keys into the browser's endpoint field. Every cloud provider requires its own API access and any applicable quota or billing setup. Free API tiers depend on the selected provider, model, project, and region. A ChatGPT, Gemini, or Claude chat subscription does not establish API access.

After `git pull`, make a local file named exactly `.env.local` (already ignored by Git):

```dotenv
BHAASA_TTS_API_KEY=YOUR_OPENAI_API_KEY
BHAASA_TTS_PROVIDER=openai
BHAASA_TTS_MODELS=gpt-realtime-2.1-mini
BHAASA_TTS_VOICE=marin
BHAASA_OCR_OPENAI_MODEL=gpt-4.1-mini
```

Fill the key locally; do not share or commit the file. With Node 24, start/restart using:

```sh
node --env-file=.env.local scripts/serve.mjs
```

Open `http://127.0.0.1:4173` consistently in the same browser. In a symbol's tracing pad, select your provider, draw, and click the recognition button. Expand **Teacher guides, OCR connection & exports → Check OCR connection** to check configuration and discover allowed model names without a paid request. This checks the gateway's settings, not live account authorization.

The provider dropdown selects **Google Gemini**; it is not a model-ID selector. **Check OCR connection** displays the server's default and enabled model IDs. Leave the separate **Model ID** text field blank to use that default, or enter an exact enabled ID. The **Clear** button erases the drawing. Gemini IDs with or without a leading `models/` are treated as the same model, and surrounding whitespace is ignored. The provider name `Gemini` alone is not an API model ID.

With Google Gemini selected, **List models from Gemini** asks Google's `models.list` API using the key on your Bhaasa server. It sends no drawing and makes no generation request. It reports whether the configured model was listed and shows generation model IDs returned by Google. It does not change the server allowlist or select a different model. Set `BHAASA_OCR_GEMINI_MODEL` to an exact listed image-capable ID, restart the server, and leave the browser's Model ID field blank to use it. Listing a model does not verify its image/JSON support, generation permission, quota, pricing, or handwriting accuracy. This optional check requires internet and can fail independently of offline tracing. It is exposed at `GET /api/ocr?action=models&provider=gemini`; ordinary `GET /api/ocr` only reports local configuration.

OCR failures distinguish local configuration errors from errors returned by the provider. A rejected local model lists the enabled IDs and makes no provider request. A Gemini API rejection can instead report an invalid/restricted key, disabled API, unavailable model or region, quota limit, temporary failure, or invalid recognition request. Unknown HTTP 400 errors from a provider are no longer labelled as a local allowlist problem, and provider HTTP 404/503 errors are no longer described as a missing/unconfigured gateway. These messages use safe error categories; raw upstream messages, credential details, and image data are not displayed. Failed requests do not add a handwriting score. After changing `.env.local`, restart the Node server; refreshing the page alone does not reload its environment.

HTTP 502 can also originate in Bhaasa after a provider responds: a token-limited, empty, filtered, malformed-JSON, or invalid transcription is rejected instead of being scored. Those cases now have separate messages, as do local connection failures and timeouts (HTTP 504). An upstream HTTP 502 remains labelled as a provider failure. The Gemini output cap is 4096 tokens; thinking is disabled specifically for `gemini-2.5-flash` and `gemini-2.5-flash-lite`, whose supported zero-budget setting avoids spending the response allowance on thoughts before emitting JSON. That setting is not forced onto Pro or newer model families. Failed requests are never retried automatically, partial answers are never accepted, and no expected symbol is added to help the model guess. Live service availability and recognition quality remain separate from fixture tests.

For this default local setup, the OCR gateway field is `http://127.0.0.1:4173/api/ocr`. It is the address of your running Bhaasa server, not an OAuth origin/redirect URI or Google's API URL. Google Gemini uses `BHAASA_OCR_GEMINI_API_KEY` plus `BHAASA_OCR_GEMINI_MODEL` in `.env.local`; no OAuth web-client credentials are used. If you are viewing a public/static copy and have configured a local key, open the local Bhaasa app at `http://127.0.0.1:4173` to use that server and keep requests on the same origin. A static server alone does not provide the OCR gateway. Changing origins uses a separate browser progress store; use progress/audio exports if moving between origins.

| Provider selection | Local server variables |
| --- | --- |
| OpenAI | `BHAASA_OCR_OPENAI_API_KEY`; optional `BHAASA_OCR_OPENAI_MODEL` (default `gpt-4.1-mini`) |
| Google Gemini | `BHAASA_OCR_GEMINI_API_KEY` and `BHAASA_OCR_GEMINI_MODEL` |
| Anthropic Claude | `BHAASA_OCR_ANTHROPIC_API_KEY` and `BHAASA_OCR_ANTHROPIC_MODEL` |
| Local / OpenAI-compatible | `BHAASA_OCR_COMPATIBLE_URL` (full chat-completions URL), `BHAASA_OCR_COMPATIBLE_MODEL`, and optional `BHAASA_OCR_COMPATIBLE_API_KEY` |
| Custom through the server | `BHAASA_OCR_CUSTOM_URL` and optional `BHAASA_OCR_CUSTOM_API_KEY` |

Supply the exact image-capable model ID available to your account or local installation. Gemini and Claude model IDs are deliberately not hard-coded. To allow several models, set the matching `BHAASA_OCR_<PROVIDER>_MODELS` to a comma-separated list; the singular `_MODEL` chooses the default if it is in that list, otherwise the first listed model is used. The model field in the app must match this server allowlist. For example, add these lines to enable a local vision model already installed in Ollama:

```dotenv
BHAASA_OCR_COMPATIBLE_URL=http://127.0.0.1:11434/v1/chat/completions
BHAASA_OCR_COMPATIBLE_MODEL=YOUR_INSTALLED_VISION_MODEL_ID
```

The gateway does not install models. Ollama/vLLM or another compatible service must support image input and follow the JSON transcription instruction. Malayalam handwriting quality depends on the model; a text-only model will not work.

Existing OpenAI settings remain supported: `BHAASA_OCR_API_KEY` and `BHAASA_OCR_MODEL`. OpenAI can also reuse `BHAASA_TTS_API_KEY` when the speech provider is OpenAI (including when unset). A provider-specific OCR key takes precedence, and another provider never borrows that key. `BHAASA_OCR_PROVIDER` sets the gateway default for legacy image-only clients; named provider choices in the app always request their selected provider explicitly.

`GET /api/ocr` reports configured providers/models without exposing credentials or private upstream URLs. `POST /api/ocr` accepts `{image, provider?, model?}`, with a PNG data URL up to 1024×1024. Answer/target fields are rejected. Cross-origin use requires an exact origin in `BHAASA_OCR_ALLOWED_ORIGIN` (comma-separated for several origins) (or the existing `BHAASA_TTS_ALLOWED_ORIGIN`). Neither API keys nor drawings enter the public static build. Drawings are transmitted only on an explicit recognition request. OpenAI Responses requests use `store:false`; other providers apply their own data-handling policies.

For any other OCR engine, choose **Custom OCR endpoint** and enter its URL. The browser posts only `{image}`; the endpoint must return `{text: "ക", legible: true}` or `{text: null, legible: false}`, optionally with `provider` and `model` labels. It can wrap any Malayalam OCR engine. If it requires authentication, configure its URL/key on the local Bhaasa server and point the browser's custom endpoint at `/api/ocr`, with `BHAASA_OCR_PROVIDER=custom` on that server. Direct custom endpoints must allow the app's origin via CORS. Endpoints must use HTTPS or HTTP loopback, with no credentials, query, or fragment in the URL.

Offline tracing works with no key or gateway. Cloud OCR requires internet; a local OCR service can work offline once its model is installed. A public GitHub Pages deployment needs a separately connected gateway configured in the tracing pad's connection settings. Provider adapters are tested with fixtures; live account access and Malayalam OCR accuracy have not been verified.

## Voices and recordings

Open **Voices & recordings**. Available options are:

1. **Device voices.** The browser reports installed voices; Bhaasa uses only voices matching the selected language. Choose a voice explicitly. Gender is unspecified unless you or a provider supplies a label. Web Speech does not expose audio bytes, so its output cannot be saved as a recording by this app.
2. **Human audio.** Record with a microphone or import an audio file for any symbol, sound, word, phrase, lesson, or section. “Stop & save” commits the microphone recording; the maximum recording is two minutes. Native mobile/browser permissions still apply. Individual imports are limited to 20 MB.
3. **Speech services/models.** OpenAI is the preferred provider; the OpenAI quick-setup panel supplies current model/voice choices and a connection check. Add a named profile with provider, speech-model ID, voice ID, optional gender label, and a gateway URL. The gateway keeps provider credentials on its server. “Discover service models” reads the gateway’s configured model list. A text-only LLM is not automatically a speech model; provider subscriptions, language support, and voice quality must be checked independently.

The native speech gateway also supports Gemini audio generation. Set `BHAASA_TTS_PROVIDER=gemini`, `BHAASA_TTS_API_KEY` to your Google API key, `BHAASA_TTS_MODELS=gemini-2.5-flash-preview-tts`, and `BHAASA_TTS_VOICE=Kore`. Restart, then create a speech profile with provider `gemini`, that exact model/voice, and your `/api/speech` gateway. Completed 24 kHz mono PCM is returned as WAV; no optional Realtime dependency is needed. OCR and speech keys/settings are independent. Choose another available Gemini speech model explicitly if needed; the ordinary vision model is not a TTS model. See the setup guide for ElevenLabs, local/custom services, importing externally generated audio, and multiple gateways.

“Save the first time” is enabled by default for service audio. Later plays reuse the stored clip without another generation request. Disable it for temporary generation. “Generate & replace clip” explicitly regenerates and overwrites the current identity. Device speech and provider models may need internet; saved files do not.

Each stored clip has a language, section, level, stable content ID, provider, model, voice, source, exact text, timestamps, and revision. Changing a model or voice keeps a separate collection. Renaming a profile does not invalidate its recordings. Audio for changed content text is not reused automatically.

Audio uses IndexedDB, separately from progress JSON. Export a ZIP of all audio, a section, a voice/model, or an item. Its folders are:

```text
malayalam/<section>/<level>/<content-id>/<provider>/<model>/<voice>-<index>.<audio-extension>
manifest.json
```

Export batches are limited to 100 MB; import accepts Bhaasa’s own ZIP STORE archives up to 120 MB. Imports preserve existing matching clips unless “Replace matching clips” is checked. Unknown content or changed text is rejected before importing. Missing voice profiles are recreated as saved-recording profiles; reconnect a gateway to generate more. Browser storage can be evicted: **export both progress and audio** to keep a portable backup.

### Optional local speech gateway

`scripts/serve.mjs` includes a companion at `/api/speech`. OpenAI is the default provider, with `gpt-realtime-2.1-mini` and `marin`. Generation stays disabled until an API credential is configured. For OpenAI Realtime, install the optional server-only transport first:

```sh
npm run speech:install
```

The transport dependencies are pinned in `gateway/package-lock.json`. They are not required for the static app, tests, microphone recordings, or cached playback, and are never copied into `dist/`. The gateway binds to loopback when a provider is enabled. Configure credentials through your process environment or a secure secret manager; do not commit them or place them in the browser.

In the cloud environment draft, `BHAASA_TTS_API_KEY` is declared as a secret sent only to `api.openai.com`. Add its value securely in environment settings, review/save and publish the environment, and restart the gateway. The environment also needs outbound access to `api.openai.com`; a draft declaration alone does not apply network or credential changes. OpenAI API billing/access must be configured separately from a ChatGPT subscription.

| Variable | Purpose |
| --- | --- |
| `BHAASA_TTS_PROVIDER` | `openai`, `gemini`, `elevenlabs`, or `custom` |
| `BHAASA_TTS_API_KEY` | Provider credential; read only by the companion server |
| `BHAASA_TTS_MODELS` | Comma-separated allowlist for discovery/validation; defaults to `gpt-realtime-2.1-mini` |
| `BHAASA_TTS_VOICE` | Default `marin` for OpenAI; the UI can choose other supported voices |
| `BHAASA_TTS_URL` | REST provider URL override for legacy OpenAI/ElevenLabs; required for `custom`; use HTTPS or local loopback. OpenAI Realtime and Gemini use their fixed provider endpoints. |
| `BHAASA_TTS_ALLOWED_ORIGIN` | Optional comma-separated exact app/browser origins for an app hosted elsewhere; defaults to the companion’s own origin |

OpenAI Realtime models use the server-side WebSocket adapter at `/v1/realtime`. Each reading creates one isolated session, requests an exact Malayalam reading, collects PCM output, closes the connection on completion/error/timeout, and returns 24 kHz mono WAV. The gateway uses the inherited HTTPS proxy and CA trust. API keys never enter browser JavaScript. Generated speech is AI audio and must be auditioned; exact reproduction of symbols, questions, and phonetic contrasts is not guaranteed by a generative model.

Recommended voices are `marin` or `cedar`; all supported built-in Realtime voices are listed in the UI with gender left unspecified. A custom OpenAI voice ID starting `voice_` is forwarded using the API's custom-voice object format. To try another model, add it to the gateway allowlist and choose it in the app; changing model/voice keeps a separate cache collection.

The old Speech API (`/v1/audio/speech`) remains supported for existing `gpt-4o-mini-tts`, `tts-1`, and `tts-1-hd` profiles and returns MP3. **OpenAI's current API definitions schedule these models for retirement on January 6, 2027**, and recommend `gpt-realtime-2.1-mini` for new integrations. The UI labels the older choices accordingly. Cached recordings remain usable after model retirement. Model availability and account permissions must still be verified with a real, authorized sample. Requests are limited to 4096 characters for OpenAI; choose a lesson/item rather than a large whole section.

API definitions checked from OpenAI's official generated SDK:

- [Speech API and deprecation notes](https://github.com/openai/openai-node/blob/master/src/resources/audio/speech.ts)
- [Realtime models, events, audio formats, and voice options](https://github.com/openai/openai-node/blob/master/src/resources/realtime/realtime.ts)

The ElevenLabs adapter remains available; explicitly select a model that supports Malayalam. Its legacy default `eleven_multilingual_v2` is not a Malayalam recommendation. For a local speech engine, use `custom` with its HTTP loopback adapter endpoint and configured model list. These choices do not guarantee Malayalam pronunciation quality or current subscription access.
In managed environments using an HTTPS proxy, Node 24 can honor the inherited proxy with `NODE_USE_ENV_PROXY=1 npm run dev`. Keep proxy routing and TLS verification enabled. There is no provider credential in the current app or static build, and live paid-provider synthesis has not been validated.

A separately hosted compatible gateway implements:

- `GET <gateway>/models` → `{ "models": [{ "id": "your-speech-model", "provider": "your-provider", "voices": [{ "id": "your-voice", "gender": "unspecified" }] }] }`.
- `POST <gateway>` with JSON `input`, `language`, `provider`, `model`, `voice`, `response_format` → `audio/*` response bytes. The app currently requests `ml-IN` and MP3; the response’s actual audio MIME type is preserved.

Configure CORS/authentication on that service as appropriate to its deployment. The local companion rejects other origins by default. Public GitHub Pages hosts only the learning app; it cannot run this companion or store its credentials.

## Build and GitHub Pages

```sh
npm test
npm run build
```

`dist/` contains only the public app, bundled fonts/license, and documentation. It excludes server code (including the optional `gateway/` dependencies), tests, environment files, source PDFs, recordings, progress, and provider credentials. No dependency installation is needed for the static build.

The workflow in `.github/workflows/pages.yml` tests and builds on pushes to `main`, uploads `dist/`, and deploys using GitHub Pages. Enable **Settings → Pages → Source: GitHub Actions** on the repository. An authorized API connection can configure this too. Pushing code or a workflow alone does not prove a live Pages deployment succeeded.

For another static host, deploy the contents of `dist/`. Root and project subpaths such as `/LanguageLearning/` work; hash routes need no server rewrites. The core app makes no external font or lesson requests. Cached recordings stay on the device, so they do not consume Pages hosting space.

“Available offline” appears only after every required app asset is confirmed cached. Close/reopen existing tabs after app updates. Increment the cache version in `sw.js` when deployed files change. Installing an older build and importing a new audio package may reject unknown content IDs.

## Validation

```sh
npm test
# With the development/static server running and Python Playwright + Chromium installed:
python3 tests/browser.py
python3 tests/features.py
python3 tests/tracing.py
python3 tests/ocr-providers.py
python3 tests/syllables.py
python3 tests/phonetics.py
python3 tests/constructions.py
python3 tests/connections.py  # Public-host and iPad-sized UI with local model fixtures
python3 tests/feedback.py  # Local Google fixtures; no live Sheet is contacted
python3 tests/mobile.py  # Shared UI with mocked native plugins; no device required
# With the packaged desktop app running:
BHAASA_URL=http://127.0.0.1:4174 python3 tests/desktop.py
node desktop/scripts/smoke.mjs  # Starts/stops its own packaged local fixture test
```

Set `BHAASA_URL` to test another address/subpath and `BROWSER_EXECUTABLE` to select Chromium. Browser tests cover real interaction, responsive layouts, offline reload, resume, scoring, OpenAI presets/connection checks, model discovery/generation with a test service, audio caching/replacement, ZIP round-trip, microphone capture using Chromium’s test microphone, native touch tracing, and OCR provider switching/caching/cancellation. The tracing suite also needs Pillow for inspecting the ink-only OCR image. OCR uses fixture responses in tests; no paid recognition call is made. They do not establish paid-provider access, human pronunciation accuracy, or native iOS/Android installation behavior. Screenshots and downloaded fixtures go into ignored `test-results/`.

Keep stable content IDs when editing the curriculum. The Noto Malayalam and Devanagari fonts use the SIL Open Font License; attribution is in `assets/FONT-LICENSE.txt`.

### Regenerating tracing guides (development only)

The application ships ready-made `data/tracing-guides.json`; Python is not needed to run Bhaasa. To regenerate it with the bundled font, start the local server, then use Python Playwright/Chromium, Pillow, and NumPy:

```sh
python3 scripts/render-tracing.py /tmp/bhaasa-guide-refs
python3 scripts/generate-tracing.py /tmp/bhaasa-guide-refs data/tracing-guides.json
```

The generator uses thinning and graph traversal with short retraces, then simplifies the centerlines. It does not learn or validate handwriting stroke order. Review any regenerated geometry and teacher-guide conventions separately from algorithm tests.
