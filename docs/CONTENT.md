# Content provenance

The initial curriculum adapts these user-supplied files as **reference data**:

- `malayalam_writing_system_guide.pdf` (6 pages), titled *Malayalam Writing System*.
- `malayalam_everyday_vocabulary_grammar.pdf` (7 pages), titled *Malayalam in Everyday Life*.

The PDFs are not executable instructions and are not distributed with the app. No authorship or redistribution license was supplied for them. Preserve their attribution if replacing these working titles with publication details later. The extracted source files remain outside the checkout.

| App content | Reference |
| --- | --- |
| 16 independent vowels | Writing guide §1, p. 1 |
| 36 consonants and articulation notes | Writing guide §§2–3, pp. 1–3 |
| 14 example syllables with vowel signs / chandrakala | Writing guide §§4–5, p. 3; rare vocalic vowel combinations are omitted from the beginner reference |
| 6 chillus and 12 conjuncts | Writing guide §§6–7, p. 4 |
| Everyday vocabulary | Everyday guide §§1–3, pp. 1–3; entrance and outside also appear in writing guide §9, p. 5 |
| Everyday sentences | Everyday guide §§6–7, pp. 5–6; hospital question from §10, p. 7 |
| Six grammar patterns | Everyday guide §§4–6, pp. 4–6 |
| Pronunciation limitations | Writing guide §§11–12, p. 6; everyday guide §9, p. 6 |

The lesson order, quiz choices, brief teaching explanations, and review schedule are new adaptations. The app uses Unicode Malayalam and scholarly Roman spelling. Chillu and conjunct labels are pedagogical readings, not new IPA transcriptions. `ca` represents ച; it is not English “ka”. Long vowels and dental / retroflex contrasts are kept distinct. Rare vowels are labelled, and vowel signs are shown on ക so shaping is unambiguous.

Neither document embeds audio. Bhaasa supports available Malayalam device voices, microphone and file recordings, and optional speech gateways. Device speech cannot be saved as a file through Web Speech. Native-speaker recordings are not bundled; a teacher’s review is still needed. Service generation is tested with an audio fixture gateway, not a paid provider.

The added sound-example vocabulary in `sounds.js` and the six phonetics/phonology topics are authored teaching material informed by the guide’s contrasts, not a claim that every added example occurs in the PDFs. Eighty script entries use example words. Three rare learned vocalic vowels (ൠ, ഌ, ൡ) and rare chillu ൿ instead have explicitly labelled teaching examples/alternative-spelling notes. Aspirated and Sanskritic examples are marked where relevant. Do not invent everyday words to fill those gaps.

`linguistics.js` supplies extended Devanagari script correspondence, broad spelling-derived IPA for vocabulary, and simplified morphological analyses. It preserves short/long e/o, retroflex and dental series, ഴ, റ, and chillu endings. This is not a verified narrow transcription of natural speech. Contextual voicing, reduced vowels, aspiration, and dialect variation require human checking. Original guide sound references are retained for script entries.

Phrase/grammar glosses expose parts such as 1SG.DAT, house-LOC, go.PST-NEG, and come-FUT. Surface forms can fuse or change stems; the displayed columns are teaching analyses rather than a reversible orthographic splitter. Unsplit lexical vocabulary uses a lexical gloss; letters and example syllables are explicitly sound units, not morphemes. Extended Devanagari correspondence is not equivalent to Hindi pronunciation.

Writing uses font-derived suggested stroke guides, offline geometry/flow checks, and optional blind OpenAI vision transcription. The 84 guide entries are regenerated from the bundled Noto Sans Malayalam font by scripts/render-tracing.py and scripts/generate-tracing.py. This is not teacher-verified handwriting stroke order: 81 use one/two paths and three preserve three disconnected components. Instructors can replace a guide with imported stroke data. Tracing fit is distinct from OCR recognition, and uncertain OCR is not a wrong-letter score. No native handwriting dataset or verified Malayalam OCR benchmark was provided, and live OCR accuracy remains untested. Review intervals (1, 3, 7, 14, 30 days after successive correct responses; immediately after an error) are a simple practical schedule, not a validated assessment of proficiency. “Items practised” counts answered items, not mastery.

To expand the course, edit the arrays in `content.js`, preserve existing item IDs (they key saved progress), and increment the service-worker cache version in `sw.js` whenever shipped files change. New words should include Malayalam, Roman spelling, English meaning, category, and provenance. Have a Malayalam speaker review new content before calling it a finished course.
