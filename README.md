# Bhaasa conversation handoff downloads

Export dated **13 November 2026**.

| Download | Contents |
| --- | --- |
| [Markdown handoff and available conversation](https://github.com/bhaashik/LanguageLearning/raw/refs/heads/conversation-exports/2026-11-13/Bhaasa-Handoff.md) | Requirements, decisions, working configuration, unresolved work, available user messages and assistant responses. |
| [Small transfer bundle — 4.3 MB ZIP](https://github.com/bhaashik/LanguageLearning/raw/refs/heads/conversation-exports/2026-11-13/Bhaasa-Transfer-Bundle.zip) | Recommended for continuing in another conversation: handoff, both source snapshots, web build, screenshot, guides and sanitized setup metadata. Native installers omitted. |
| [All recovered files — 95.2 MB ZIP](https://github.com/bhaashik/LanguageLearning/raw/refs/heads/conversation-exports/2026-11-13/Bhaasa-Recovered-Files.zip) | Source, generated web build, screenshot, guides, templates, sanitized setup metadata and historical Linux/Windows/Android/unsigned iOS packages. |

[SHA-256 checksums](2026-11-13/EXPORT-SHA256SUMS.txt) · [Machine-readable file status](2026-11-13/status.json) · [Read Markdown on GitHub](2026-11-13/Bhaasa-Handoff.md)

Click an individual ZIP link above to download an export. GitHub's Code → Download ZIP downloads this entire branch, including both overlapping bundles.

## Coverage limits

This is a recovery export, **not a complete verbatim chat transcript**. Most earlier assistant turns were unavailable in full. The handoff distinguishes quoted available messages from summarized earlier decisions.

Two original PDFs could not be recovered: `malayalam_everyday_vocabulary_grammar.pdf` and `malayalam_writing_system_guide.pdf`. Files held only in the user's Google Cloud Shell were also unavailable. The larger archive includes `MISSING_FILES.md` and a payload inventory/checksums.

The local validated source is commit `61d4e7d81147327b491553f906a0397ce6ed570d` (v0.7.2). The separately labelled remote main source is commit `129f0ab05c9115ed62d9b9d586c956143d940ed2`. The native packages are historical v0.7.1 builds. The iOS archive needs Apple signing and cannot be installed directly.

No provider keys, gateway access tokens, private environment files, signing keys or browser storage are included. This branch contains the conversation handoff and app-related files selected for transfer; it is separate from main.

## Verification

Download the checksums beside the three export files. On Linux:

```sh
sha256sum -c EXPORT-SHA256SUMS.txt
```
