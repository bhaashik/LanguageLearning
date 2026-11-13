# Bhaasa Firebase gateway

Deploy the existing Gemini OCR, TTS, and ASR adapters as one authenticated HTTP Cloud Function. Keep the app on GitHub Pages. Follow [the setup guide](../docs/FIREBASE.html), including billing, Secret Manager, allowed origins, deployment, and the app’s session access token.

Install with Node 22: `npm ci --prefix firebase/functions` from the repository root. Deploy from this folder: `firebase deploy --only functions:bhaasa --project YOUR_PROJECT_ID`. Do not run `firebase init` over the template. It needs your own Google project and login; no cloud credentials are provided in the repository.

`build.mjs` copies an explicit list of shared server adapters into ignored `functions/lib` before deployment, then verifies their imports. Browser settings and the Firebase browser SDK are excluded, along with source lessons, local provider files, and the local development/static file server. Secrets are resolved only at request time. The application token is separate from the Gemini key and guards configuration/model-list requests as well as generation. There is no unauthenticated paid proxy.

## Existing bhaashik-apps gateway

Keep the existing `BHAASA_GEMINI_API_KEY` and `BHAASA_GATEWAY_TOKEN` secrets. This project already has a deployed gateway at `https://bhaasaapi-uvij6mdx3q-uc.a.run.app`; check its current settings before redeploying. There is no need to initialize Firebase again or recreate the project, key or gateway token.

The gateway defaults are `gemini-3.1-flash-lite` for OCR and ASR, and `gemini-2.5-flash-preview-tts` / `Kore` for TTS. These were the working choices in the project handoff, not a guarantee of current model access. Explicit settings in `functions/.env.bhaashik-apps` override source defaults. Preserve that file and unrelated settings when updating the models. Keep the GitHub Pages origin and each local browser origin you actually use in `BHAASA_ALLOWED_ORIGINS`.

From the updated repository root, stage and check the gateway before deployment:

```sh
npm run firebase:build
npm test
```

From `firebase/`, deploy only this codebase using your existing Cloud Shell login:

```sh
npx --yes firebase-tools deploy --config "$PWD/firebase.json" --only functions:bhaasa --project bhaashik-apps
```

## Verify the deployed services

From the repository root in Cloud Shell, load the existing gateway token privately. The Gemini key stays in Secret Manager and is not needed by this check:

```sh
export BHAASA_GATEWAY_TOKEN="$(gcloud secrets versions access latest --secret=BHAASA_GATEWAY_TOKEN --project=bhaashik-apps)"
npm run gateway:check -- --base https://bhaasaapi-uvij6mdx3q-uc.a.run.app
```

The default check reads all three Gemini configurations, checks browser preflights, and verifies unauthenticated metadata requests receive HTTP 401. It sends no learning content and does not call model generation. An HTTP success here does not establish billing, quota or model availability.

To explicitly make one short TTS request and transcribe the returned WAV through ASR:

```sh
npm run gateway:check -- --base https://bhaasaapi-uvij6mdx3q-uc.a.run.app --generate
```

Those two generation calls use the key's API allowance/billing. Add `--language fr` for a separate French check. Review the transcript; a successful transcript is not a pronunciation grade.

To check a real handwriting sample, add `--image /path/to/handwriting.png`. Only the image, provider and model are sent; no expected letter is supplied. A structurally valid OCR result can still be wrong or uncertain, so compare it with the actual ink. Blank-image false positives remain a known recognition limitation.

Repeat with `--origin http://127.0.0.1:4173` for your local app (or the actual port, such as 4181), after allowing that exact origin on the deployed gateway. The diagnostic makes real HTTP requests and does not simulate browser behavior; also test handwriting, Listen and a recorded speaking check in the web app. Use `node firebase/check.mjs --help` for file options. Checks do not log the gateway token; never paste secret values into a report or chat.

This is a trusted-testing setup, not a public multi-user authorization service. Add individual authentication and usage controls before broad distribution. Native test downloads built before these controls need rebuilding; use the updated browser app first.
