# Bhaasa · Sounds, scripts, and everyday language

Bhaasa starts with Malayalam and the two learning guides supplied for this project. The core app is static HTML, CSS, and JavaScript with no runtime packages or backend requirement. Progress and recordings stay on the learner’s device. New speech generation is optional and can use a separately connected service.

## Run

With Node.js 20+ (Node 24 recommended):

```sh
cd /workspace/LanguageLearning
npm run dev
```

The development server uses port 4173 (`PORT` overrides it). Any static HTTP server also serves the core app; HTTPS or localhost is required for installation, offline caching, and microphone access. Do not open `index.html` through `file://`.

## Learning workflow

- Ten guided lessons and an unrestricted script reference: 16 vowels, 36 consonants, 14 vowel-sign examples, 6 chillus, and 12 conjuncts.
- Script examples use actual words for common symbols. Three rare learned vocalic vowels and rare chillu ൿ have explicit teaching examples/alternative-spelling notes rather than invented everyday words.
- 66 everyday words, 10 phrases, additional sound-example vocabulary, six grammar patterns, and a six-part **Sounds of Malayalam (Phonetics & Phonology)** section.
- Roman spelling, broad IPA, extended Devanagari, and simplified morpheme glosses are available in expandable details on learning cards, script examples, grammar examples, recap, and answer feedback. Letters/syllables are labelled as sound units, not morphemes. Joined word forms can differ from their segmented analysis.
- Freehand writing with guide/undo/clear; this is not handwriting grading or stroke-order instruction.
- Recognition, grammar, and sound-pattern exercises. Every exercise ends with its complete answer key, including the learner’s answers and explanatory detail.
- Separate colored accuracy bars for writing-system recognition, phonetics, words, phrases, and grammar, both **this session** and **overall**. Scores measure answered questions, not proficiency or freehand writing quality.
- Automatic return to the last page/card or unfinished exercise when opening the base address, plus a brief recap. An explicit link to any section always works. Already answered quiz questions do not score twice after reload.
- Sessions survive reloads, restart after 30 minutes without interaction, and can be restarted explicitly without erasing overall results.
- Progress JSON backup/import, including migration from the original Aksharam progress format. Progress is local to this origin/browser, not synchronized across devices.

Content details and limitations are in [docs/CONTENT.md](docs/CONTENT.md). Word/sentence IPA is a broad **spelling-based approximation**, not a verified narrow transcription of natural speech. Extended Devanagari is comparative script correspondence, not ordinary Hindi pronunciation. A Malayalam teacher’s review and native-speaker recordings are still needed for a finished curriculum.

## Voices and recordings

Open **Voices & recordings**. Available options are:

1. **Device Malayalam voices.** The browser reports its installed voices; Bhaasa only uses Malayalam voices. Choose a voice explicitly. Gender is unspecified unless you or a provider supplies a label. Web Speech does not expose audio bytes, so its output cannot be saved as a recording by this app.
2. **Human audio.** Record with a microphone or import an audio file for any symbol, sound, word, phrase, lesson, or section. “Stop & save” commits the microphone recording; the maximum recording is two minutes. Native mobile/browser permissions still apply. Individual imports are limited to 20 MB.
3. **Speech services/models.** OpenAI is the preferred provider; the OpenAI quick-setup panel supplies current model/voice choices and a connection check. Add a named profile with provider, speech-model ID, voice ID, optional gender label, and a gateway URL. The gateway keeps provider credentials on its server. “Discover service models” reads the gateway’s configured model list. A text-only LLM is not automatically a speech model; provider subscriptions, language support, and voice quality must be checked independently.

“Save the first time” is enabled by default for service audio. Later plays reuse the stored clip without another generation request. Disable it for temporary generation. “Generate & replace clip” explicitly regenerates and overwrites the current identity. Device speech and provider models may need internet; saved files do not.

Each stored clip has a language, section, level, stable content ID, provider, model, voice, source, exact text, timestamps, and revision. Changing a model or voice keeps a separate collection. Renaming a profile does not invalidate its recordings. Audio for changed content text is not reused automatically.

Audio uses IndexedDB, separately from progress JSON. Export a ZIP of all audio, a section, a voice/model, or an item. Its folders are:

```text
malayalam/<section>/<level>/<content-id>/<provider>/<model>/<voice>-<index>.<audio-extension>
manifest.json
```

Export batches are limited to 100 MB; import accepts Bhaasa’s own ZIP STORE archives up to 120 MB. Imports preserve existing matching clips unless “Replace matching clips” is checked. Unknown content or changed text is rejected before importing. Missing voice profiles are recreated as saved-recording profiles; reconnect a gateway to generate more. Browser storage can be evicted: **export both progress and audio** to keep a portable backup.

### Optional local speech gateway

`scripts/serve.mjs` includes a companion at `/api/speech`. OpenAI is the default provider, with `gpt-realtime-2.1-mini` and `marin`. Generation stays disabled until an API credential is configured. Install the optional server-only transport first:

```sh
npm run speech:install
```

The transport dependencies are pinned in `gateway/package-lock.json`. They are not required for the static app, tests, microphone recordings, or cached playback, and are never copied into `dist/`. The gateway binds to loopback when a provider is enabled. Configure credentials through your process environment or a secure secret manager; do not commit them or place them in the browser.

In the cloud environment draft, `BHAASA_TTS_API_KEY` is declared as a secret sent only to `api.openai.com`. Add its value securely in environment settings, review/save and publish the environment, and restart the gateway. The environment also needs outbound access to `api.openai.com`; a draft declaration alone does not apply network or credential changes. OpenAI API billing/access must be configured separately from a ChatGPT subscription.

| Variable | Purpose |
| --- | --- |
| `BHAASA_TTS_PROVIDER` | `openai`, `elevenlabs`, or `custom` |
| `BHAASA_TTS_API_KEY` | Provider credential; read only by the companion server |
| `BHAASA_TTS_MODELS` | Comma-separated allowlist for discovery/validation; defaults to `gpt-realtime-2.1-mini` |
| `BHAASA_TTS_VOICE` | Default `marin` for OpenAI; the UI can choose other supported voices |
| `BHAASA_TTS_URL` | REST provider URL override; required for `custom`; use HTTPS or local loopback. The OpenAI Realtime adapter always uses `api.openai.com`. |
| `BHAASA_TTS_ALLOWED_ORIGIN` | Optional exact browser origin for an app hosted elsewhere; defaults to the companion’s own origin |

OpenAI Realtime models use the server-side WebSocket adapter at `/v1/realtime`. Each reading creates one isolated session, requests an exact Malayalam reading, collects PCM output, closes the connection on completion/error/timeout, and returns 24 kHz mono WAV. The gateway uses the inherited HTTPS proxy and CA trust. API keys never enter browser JavaScript. Generated speech is AI audio and must be auditioned; exact reproduction of symbols, questions, and phonetic contrasts is not guaranteed by a generative model.

Recommended voices are `marin` or `cedar`; all supported built-in Realtime voices are listed in the UI with gender left unspecified. A custom OpenAI voice ID starting `voice_` is forwarded using the API's custom-voice object format. To try another model, add it to the gateway allowlist and choose it in the app; changing model/voice keeps a separate cache collection.

The old Speech API (`/v1/audio/speech`) remains supported for existing `gpt-4o-mini-tts`, `tts-1`, and `tts-1-hd` profiles and returns MP3. **OpenAI's current API definitions schedule these models for retirement on January 6, 2027**, and recommend `gpt-realtime-2.1-mini` for new integrations. The UI labels the older choices accordingly. Cached recordings remain usable after model retirement. Model availability and account permissions must still be verified with a real, authorized sample. Requests are limited to 4096 characters for OpenAI; choose a lesson/item rather than a large whole section.

API definitions checked from OpenAI's official generated SDK:

- [Speech API and deprecation notes](https://github.com/openai/openai-node/blob/master/src/resources/audio/speech.ts)
- [Realtime models, events, audio formats, and voice options](https://github.com/openai/openai-node/blob/master/src/resources/realtime/realtime.ts)

The ElevenLabs adapter remains available with model `eleven_multilingual_v2`. For a local speech engine, use `custom` with its HTTP loopback endpoint and configured model list. These choices do not guarantee Malayalam pronunciation quality or current subscription access.
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
```

Set `BHAASA_URL` to test another address/subpath and `BROWSER_EXECUTABLE` to select Chromium. Browser tests cover real interaction, responsive layouts, offline reload, resume, scoring, OpenAI presets/connection checks, model discovery/generation with a test service, audio caching/replacement, ZIP round-trip, and microphone capture using Chromium’s test microphone. They do not establish paid-provider access, human pronunciation accuracy, or native iOS/Android installation behavior. Screenshots and downloaded fixtures go into ignored `test-results/`.

Keep stable content IDs when editing the curriculum. The Noto Malayalam and Devanagari fonts use the SIL Open Font License; attribution is in `assets/FONT-LICENSE.txt`.
