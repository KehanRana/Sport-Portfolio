# Sports-as-a-Portfolio: NBA

Historical NBA analytics project. Stage 1 is implemented with React, TypeScript and Vite: a validated season loader, season selector, searchable team records and responsive dashboard. Stage 3 adds date-filtered exploration, D3 comparison/scatterplot charts and sortable analytical metrics. Stage 4 adds portfolio allocation controls and historical replay.

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

Stage 2 is implemented: pure weekly Elo-change aggregation, summary statistics, fixed-weight portfolios, neutral benchmark and drawdown calculations. See [analytics integration and conventions](src/analytics/README.md). Stage 3 now connects the engine to team exploration and comparison charts. Stage 4 now adds portfolio weight controls and replay. Next milestone (stage 5): correlation heatmap and local persistence. Use published FiveThirtyEight Elo values initially. Rating performance is expressed in synthetic units, not betting profit.

## Stage 1 verification

- TypeScript checks and production build passed.
- Nine Vitest tests passed.
- Browser checks: default 2014–15 data; Warriors search (67–15); 2012–13 switch and Boston record (41–40, 81 games); empty search and clear action.
- At a 375px viewport, document width matched viewport width (no page overflow). Full cross-browser/accessibility and performance audits remain release work.

## Stage 2 verification

- 26 tests pass, including 17 analytics tests with hand-worked examples and checks over all three historical seasons.
- Coverage includes partial weeks, idle weeks, year boundaries, sample SD, short history, zero variance, positive/negative correlation, mismatched grids, weight validation/rounding, additive indices and initial-peak drawdowns.
- The engine is independent of the Stage 1 dashboard. No new chart or portfolio UI is included yet.

## Stage 3: team exploration

- Apply an inclusive date range or reset to the full season. Invalid draft dates preserve the last valid analysis. Changing seasons resets the interval and comparisons.
- Select up to five teams using table checkboxes. Golden State and Cleveland are selected initially. Remove selections through the legend or team detail.
- Compare performance indices starting at 100. Move across the chart or use the keyboard-accessible inspection slider for weekly Elo change, index, game counts and expandable game results.
- Inspect risk versus improvement through clickable/keyboard-operable scatterplot points or the team dropdown. Its numeric alternative is the team metrics table, including mean weekly change.
- Search teams and sort by name, total Elo change, weekly sample volatility or consistency. N/A values stay last. A no-game interval retains every team with zero games.
- Expand the comparison data table or methodology for exact values and interpretation. Charts use synthetic units and include idle/partial weeks.

Verification: 29 tests pass, including filtered-record and no-game interval checks. Browser checks covered five-team limit, sorting, invalid/empty-game intervals, resetting dates, season resets, keyboard week inspection, scatterpoint activation and the comparison table. At 375px the page has no horizontal overflow; charts/tables scroll inside labelled regions. Desktop inspected at 1440px. Full cross-browser and accessibility audits remain release work.

## Stage 4: portfolio builder and replay

- Build a basket of 1–10 unique teams independently of the comparison selection. Additions start at zero weight. Remove teams or distribute equal weights; displayed equal weights sum exactly to 100%.
- Weight inputs accept 0–100%. Replay is disabled for empty/invalid inputs, unknown teams or totals outside the documented tolerance. Previous valid results remain visible while editing; a notice distinguishes draft from applied weights.
- Replay applies fixed exposures to the current evaluation interval. Date changes recompute applied weights; changing season resets the portfolio to the example. Reset restores 50% GSW / 50% CLE. Local saving is planned for Stage 5.
- Summary shows final index, total point change, weekly volatility, consistency and maximum drawdown with peak/trough dates. Performance and drawdown charts share a keyboard-operable inspection slider and a numeric replay data table.
- The all-team reference uses the same dates. Interpretation notes explain source rounding, inactivity, partial weeks and team-game exposures. This is retrospective synthetic performance, not monetary profit.

Verification: 34 tests pass, including draft validation, equal weights at every basket size from 1–10, hand-worked replay/reference/drawdown and interval recomputation without mutation. Browser checks covered invalid-total replay disabling, preservation of prior results, valid 75/25 allocations, adding a third team, 33.34/33.33/33.33 equal weights, explicit replay, reset, no-game interval and replay table. Mobile inspected at 375px with no page overflow; desktop inspected at 1440px.
