---
name: "🎙️ [Assets / Non-Coder] Native Nepali Child-Friendly Phonics Audio Pack (Swor, Vyanjan & Barakhari)"
about: "Contribute studio-clear .mp3/.ogg recordings of Nepali Swor Varna, Vyanjan Varna, and Barakhari syllables"
title: "feat(assets): add native Nepali speaker audio recordings for Swor and Vyanjan phonics"
labels: ["assets", "good first issue", "education"]
assignees: ""
---

## Context

`packages/web/src/lib/audio.ts` uses the browser's `ne-NP` Web Speech API with a Web Audio pentatonic chime synthesis fallback. Native speaker recordings are essential for diaspora learners so children can hear authentic Nepali phonetic contrasts—especially **unaspirated vs. aspirated** (`क` vs. `ख`, `च` vs. `छ`) and **dental vs. retroflex** (`त/थ/द/ध` vs. `ट/ठ/ड/ढ`).

## How Non-Coders Can Contribute

1. Record clear, warm, child-friendly pronunciations (44.1kHz mono `.ogg` or `.mp3`, 0.8s–1.5s per clip, normalized to `-16 LUFS`):
   - **13 Swor Varna:** `a.mp3` (`अ`) through `aha.mp3` (`अः`)
   - **36 Vyanjan Varna:** `ka.mp3` (`क — कपुरी क`) through `gya.mp3` (`ज्ञ — ज्ञानी ज्ञ`)
2. Place audio files in `packages/web/public/audio/phonics/` matching the `id` field in `packages/data/vowels.json` and `packages/data/consonants.json`.
3. Include a brief note in your PR confirming the recordings are your own original voice work released under the repository's MIT / CC0 license.

