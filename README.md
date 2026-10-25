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

Nine tests check all three season schemas, game coverage, derived win/loss totals, historical team names, invalid values, HTTP failures, duplicate game IDs and season mismatch. The build runs TypeScript checks before producing `dist/`.

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

Next implementation milestone (stage 2): weekly Elo-change calculations and tested statistics, followed by a team comparison chart. Use published FiveThirtyEight Elo values initially. Rating performance is expressed in synthetic units, not betting profit.

## Stage 1 verification

- TypeScript checks and production build passed.
- Nine Vitest tests passed.
- Browser checks: default 2014–15 data; Warriors search (67–15); 2012–13 switch and Boston record (41–40, 81 games); empty search and clear action.
- At a 375px viewport, document width matched viewport width (no page overflow). Full cross-browser/accessibility and performance audits remain release work.
