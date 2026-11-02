---
name: "🧩 [Education / Frontend] Interactive Conjunct Consonant (संयुक्त अक्षर / Halanta) Ligature Playground"
about: "Build a visual half-letter (आधा अक्षर) combiner teaching Virama/Halanta ligatures like क् + ष = क्ष, प् + र = प्र"
title: "feat(web): add interactive Samyukta Akshara (conjunct consonant) ligature builder"
labels: ["education", "frontend"]
assignees: ""
---

## Context

Once early learners master `MatraBuilder.tsx` (attaching vowel signs to single consonants), the next major hurdle in reading Nepali Devanagari is **Samyukta Akshara (संयुक्त अक्षर / Conjunct Consonants)** formed via the **Halanta / Virama (`्`, `U+094D`)**—such as `क् + य = क्य`, `प + ् + र = प्र`, `स + ् + क + ू + ल = स्कूल`, and `द + ् + य = द्य`.

## Acceptance Criteria

1. Extend `packages/core/src/matra-engine.ts` with `fuseConjunctConsonants(c1: string, c2: string)` describing how `c1` loses its vertical *Khadi Pai* stem (`क ➔ क्`, `ग ➔ ग्`, `स ➔ स्`) or takes a *Rakar* (`्र`) / *Repha* (`र्`) form.
2. Create an interactive visual component in `packages/web/src/components/` showing the half-letter transformation animation (`स + ् + थ = स्थ`).
3. Add 10 common Nepali children's conjunct words (`स्कूल`, `प्रणाम`, `आमाको माया`, `बच्चा`, `पुस्तक`, `नमस्ते`) with audio breakdown.
