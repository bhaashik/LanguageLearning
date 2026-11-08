# Bhaasa Firebase gateway

Deploy the existing Gemini OCR, TTS, and ASR adapters as one authenticated HTTP Cloud Function. Keep the app on GitHub Pages. Follow [the setup guide](../docs/FIREBASE.html), including billing, Secret Manager, allowed origins, deployment, and the app’s session access token.

Install with Node 22: `npm ci --prefix firebase/functions` from the repository root. Deploy from this folder: `firebase deploy --only functions:bhaasa --project YOUR_PROJECT_ID`. Do not run `firebase init` over the template. It needs your own Google project and login; no cloud credentials are provided in the repository.

`build.mjs` copies an explicit list of shared server adapters into ignored `functions/lib` before deployment. Source lessons, local provider files, and the local development/static file server are excluded. Secrets are resolved only at request time. The application token is separate from the Gemini key and guards configuration/model-list requests as well as generation. There is no unauthenticated paid proxy.

This is a trusted-testing setup, not a public multi-user authorization service. Add individual authentication and usage controls before broad distribution. Native test downloads built before these controls need rebuilding; use the updated browser app first.
