# Analytics engine

Pure TypeScript; no React, DOM, storage, network or locale dependencies. Model version: `ANALYTICS_VERSION` in engine.ts. Uses published FiveThirtyEight Elo; does not fit a new rating model.

## Integration

```ts
import { aggregateWeeks, analyseSeries, portfolioWeeks, benchmarkWeeks, correlation } from './engine';

const weekly = aggregateWeeks(season, '2014-10-28', '2015-04-15');
const team = analyseSeries(weekly.teams.GSW, weekly.start, weekly.end);
const portfolio = analyseSeries(
  portfolioWeeks(weekly, [
    { teamId: 'GSW', percent: 60 },
    { teamId: 'CLE', percent: 40 },
  ]), weekly.start, weekly.end,
);
const reference = analyseSeries(benchmarkWeeks(weekly), weekly.start, weekly.end);
const relationship = correlation(weekly.teams.GSW, weekly.teams.CLE);
```

Pass runtime-validated Season data from the data loader. Evaluation dates are inclusive and must be within the season's first/last game dates. Team IDs are season-specific (e.g. CHA versus CHO).

## Rules for the UI

- Weeks start Monday and end Sunday, using date-only UTC arithmetic so the user's timezone does not change grouping.
- Boundary weeks include only games within the selected dates. Include and label these partial weeks; they are still observations in the statistics.
- Every team shares the same weekly grid. A week without games has change 0 and games 0; label inactivity rather than implying measured consistency.
- Team weekly `games` counts actual games. Portfolio weekly `games` counts team-game exposures for positive-weight selections (both opposing teams can count). Benchmark `games` counts unique games. Do not label portfolio exposures as unique fixtures.
- Weights are percentages, 1–10 unique teams, each 0–100. Accept total 100 ±0.01 percentage points; normalise to exact fractional weights for calculation. Show that rounding adjustment when applicable. Zero weight is allowed and contributes no exposure.
- All performance indices start at 100 and add Elo changes. They are synthetic units, not money or percentage investment returns. Drawdowns are index points; maximum drawdown magnitude is positive. Weekly drawdown can miss a worse intraweek decline.
- Mean requires one observation; sample SD requires two. Consistency and correlation require ten weeks; zero variance makes those ratios unavailable. Metrics expose `value: null` and a reason for N/A rendering. SD of a constant series is valid zero.
- Correlation requires exactly matching week grids and reports paired observation count, including idle weeks. Games played, partial weeks and direct opponents affect interpretation.
- The series includes an opening baseline at evaluation start, then one point per weekly bucket at its final included date. A baseline and weekly observation may share a date for a one-day boundary bucket; preserve their ordering rather than deduplicating by date.
- Maximum drawdown includes the initial peak. Equal-height peaks keep their first date; equal maximum drawdowns keep the first occurrence. A zero drawdown reports the evaluation start for both dates.
- The all-team benchmark is neutral in principle. Small nonzero movement remains because the published source Elo values are rounded. Do not overwrite source changes to manufacture exact zero.
- No annualisation or risk-free rate adjustment. Label consistency as Sharpe-style, not a financial Sharpe ratio. Portfolio selection is retrospective.

Run `npm test` for hand-worked fixtures and all-season integration checks. UI wiring and chart interactions belong to later stages.
