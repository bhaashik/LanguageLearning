# Bhaasa Google Sheets collector

Copy `Code.gs` and `appsscript.json` into a Google Apps Script project owned by the Sheet owner. Set the **Script Property** `BHAASA_FEEDBACK_SHEET_ID`, then deploy as a Web app, executing as **Me**, accessible to **Anyone**.

Follow the complete [setup and delivery guide](../docs/FEEDBACK.html), including a real test submission. Paste the public `/exec` deployment URL into Bhaasa's Give feedback settings, or set `FEEDBACK_COLLECTOR_URL` in `feedback-config.js` before distributing a build. No credentials or Sheet ID belong in that public config file.

This is an anonymous write-only collector for small trusted test groups. It is subject to Google quotas and spam. It does not count unique Google Play testers. Retain a private Sheet and publish appropriate privacy/contact information for your deployment. The app reports confirmed delivery only after a validated receipt following a successful Sheet write. Retry the same report ID to avoid duplicate rows.

The template itself is versioned in the source repository and excluded from the built app. Deployments are created by the owner; no Google service has been configured merely by adding these files.
