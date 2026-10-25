# Sports-as-a-Portfolio: NBA

Historical NBA analytics project. Stage 1 is implemented with React, TypeScript and Vite: a validated season loader, season selector, searchable team records and responsive dashboard. D3 visualisations and portfolio analytics follow in later stages.

## Run the app

Requires Node.js 22.14+ and npm.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite.

```sh
npm test
npm run build
npm run preview
```

Data tests check all three season schemas, game coverage, derived win/loss totals, historical team names, invalid values, HTTP failures, duplicate game IDs and season mismatch. The build runs TypeScript checks before producing `dist/`.

## Prepare data

Requires Python 3; no third-party packages or API key.

```sh
python3 scripts/prepare_data.py
```

The script validates the pinned local source, pairs opposing team records, checks scores and Elo updates, and verifies season/team coverage before writing JSON. Outputs are deterministic. It fails rather than silently dropping malformed selected games.

| Season | Teams | Regular-season games |
| --- | --- | --- |
| 2012–13 | 30 | 1,229 |
| 2013–14 | 30 | 1,230 |
| 2014–15 | 30 | 1,230 |

Read [requirements](PROJECT_REQUIREMENTS.md), [data attribution](DATA_SOURCES.md) and [dataset manifest](public/data/manifest.json).

Stage 2 is implemented: pure weekly Elo-change aggregation, summary statistics, fixed-weight portfolios, neutral benchmark and drawdown calculations. See [analytics integration and conventions](src/analytics/README.md). Next milestone (stage 3): connect this engine to team exploration and comparison charts. Use published FiveThirtyEight Elo values initially. Rating performance is expressed in synthetic units, not betting profit.

## Stage 1 verification

- TypeScript checks and production build passed.
- Nine Vitest tests passed.
- Browser checks: default 2014–15 data; Warriors search (67–15); 2012–13 switch and Boston record (41–40, 81 games); empty search and clear action.
- At a 375px viewport, document width matched viewport width (no page overflow). Full cross-browser/accessibility and performance audits remain release work.

## Stage 2 verification

- 26 tests pass, including 17 analytics tests with hand-worked examples and checks over all three historical seasons.
- Coverage includes partial weeks, idle weeks, year boundaries, sample SD, short history, zero variance, positive/negative correlation, mismatched grids, weight validation/rounding, additive indices and initial-peak drawdowns.
- The engine is independent of the Stage 1 dashboard. No new chart or portfolio UI is included yet.
