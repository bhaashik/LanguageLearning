Bhaasa desktop (portable)

Linux: extract the archive, then run ./Bhaasa. To add an application-menu entry,
run ./Bhaasa --install and keep the executable at that location.

Windows: extract the ZIP, then open Start Bhaasa.vbs (hides the server console),
or open Bhaasa.exe directly. If Windows Script Host is disabled, use the EXE.

An installed modern browser is required. Automatic selection prefers a supported
system default. Chrome/Edge/Chromium/Brave open an app window; Firefox opens a
normal window. Use --browser default to use the normal system-default browser.
No separate Node.js installation is needed.

Open About -> Desktop apps, or http://127.0.0.1:4174/desktop/ while the app runs.
There you can choose a browser and find your private provider-settings file.
Closing all Bhaasa/help/settings windows stops the local server after 30 seconds.
--no-open keeps the server running until you stop it with Ctrl+C.

Progress and audio are stored in the selected browser profile. Export both
before changing browsers, clearing data, or moving computers. Keep port 4174
stable. All choices use the selected browser's normal profile, including Snap/Flatpak
browser installations. Desktop settings do not include these browser profiles.

Lessons/tracing/saved audio need no hosting. Cloud OCR/TTS need internet and
your own provider settings in providers.env, separate from this executable.
The local gateway listens only on 127.0.0.1. Never share providers.env or browser
profile folders. No provider key is included with this package.

Help: About -> Desktop build & setup guide (included offline).
Source: https://github.com/bhaashik/LanguageLearning

These are unsigned portable builds. Windows/Linux distribution and browser
behavior must be tested on your computer. No store publication is implied.
