# Briefing — rearrumação sem espaços vazios (2026-10-10)

**Objetivo:** tirar os buracos do ecrã do Briefing (desktop).

- Duelo em largura total (`lg:col-span-3`).
- "Prepara a estratégia" passa de cartão alto a faixa fina por baixo do duelo (`PrepCtaCard.jsx`).
- 3 colunas à mesma altura: radar (último confronto/ambiente colados à base) · campo · estádio+ameaças+odds+árbitro (ameaças esticam).
- Telemóvel: igual (empilhado); a faixa passa a aparecer também aí.

**Ficheiros:** `MatchBriefing.jsx`, `briefing/PrepCtaCard.jsx`, `briefing/ThreatGrid.jsx`, `briefing/CompareRadar.jsx`, `briefing-resp-test.jsx` (cópia da grelha).
**Verificação:** lint, check:types, test:mobile, screenshot 1360.
