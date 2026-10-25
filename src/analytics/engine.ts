import type { Season } from '../data/schema';

export const ANALYTICS_VERSION = '1.0.0';
const DAY = 86_400_000;
export type Metric = { value: number; reason: null } | { value: null; reason: 'insufficient-history' | 'zero-variance' };
export interface WeeklyChange { week: string; change: number; games: number }
export interface WeeklyDataset {
  start: string;
  end: string;
  weeks: string[];
  teams: Record<string, WeeklyChange[]>;
}
export interface Weight { teamId: string; percent: number }
export interface IndexPoint { date: string; index: number; drawdown: number }
export interface Analysis {
  observations: number;
  totalChange: number;
  meanChange: Metric;
  volatility: Metric;
  consistency: Metric;
  points: IndexPoint[];
  maxDrawdown: { magnitude: number; peakDate: string; troughDate: string };
}
const available = (value: number): Metric => ({ value, reason: null });
const unavailable = (reason: 'insufficient-history' | 'zero-variance'): Metric => ({ value: null, reason });
function timestamp(date: string): number {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) throw new Error('Invalid calendar date');
  return time;
}
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
function monday(time: number): number { return time - ((new Date(time).getUTCDay() + 6) % 7) * DAY; }
function finite(values: number[]) {
  if (values.some(value => !Number.isFinite(value))) throw new Error('Analytics require finite values');
}

/** Calendar dates are source dates, independent of browser locale/timezone.
 * Include boundary weeks, but only games inside the inclusive selected interval.
 * Inactivity remains zero; it is never dropped or forward-filled as a game.
 */
export function aggregateWeeks(season: Season, start: string, end: string): WeeklyDataset {
  if (!season.games.length) throw new Error('Season has no games');
  const dates = season.games.map(game => game.date).sort();
  const startTime = timestamp(start), endTime = timestamp(end);
  if (startTime > endTime || start < dates[0] || end > dates[dates.length - 1]) throw new Error('Evaluation interval must be inside the season');
  const weeks: string[] = [];
  for (let time = monday(startTime); time <= monday(endTime); time += 7 * DAY) weeks.push(iso(time));
  const ids = [...new Set(season.games.flatMap(game => [game.home.id, game.away.id]))].sort();
  const teams: Record<string, WeeklyChange[]> = Object.fromEntries(ids.map(id => [id, weeks.map(week => ({ week, change: 0, games: 0 }))]));
  const positions = new Map(weeks.map((week, index) => [week, index]));
  for (const game of season.games) {
    if (game.date < start || game.date > end) continue;
    const position = positions.get(iso(monday(timestamp(game.date))))!;
    for (const team of [game.home, game.away]) {
      const change = team.eloAfter - team.eloBefore;
      finite([change]);
      teams[team.id][position].change += change;
      teams[team.id][position].games += 1;
    }
  }
  return { start, end, weeks, teams };
}

export function mean(values: number[]): Metric {
  finite(values);
  return values.length ? available(values.reduce((sum, value) => sum + value, 0) / values.length) : unavailable('insufficient-history');
}
export function sampleStandardDeviation(values: number[]): Metric {
  finite(values);
  if (values.length < 2) return unavailable('insufficient-history');
  const average = mean(values).value!;
  return available(Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)));
}
export function consistency(values: number[]): Metric {
  finite(values);
  if (values.length < 10) return unavailable('insufficient-history');
  const sd = sampleStandardDeviation(values).value!;
  return sd === 0 ? unavailable('zero-variance') : available(mean(values).value! / sd);
}

/** Reject unequal calendar grids instead of correlating unrelated observations. */
export function correlation(left: WeeklyChange[], right: WeeklyChange[]): Metric & { observations: number } {
  if (left.length !== right.length || left.some((point, i) => point.week !== right[i].week)) throw new Error('Correlation requires identical week grids');
  const x = left.map(point => point.change), y = right.map(point => point.change);
  finite([...x, ...y]);
  const observations = x.length;
  if (observations < 10) return { ...unavailable('insufficient-history'), observations };
  const mx = mean(x).value!, my = mean(y).value!;
  let covariance = 0, varianceX = 0, varianceY = 0;
  for (let i = 0; i < observations; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    covariance += dx * dy; varianceX += dx * dx; varianceY += dy * dy;
  }
  if (varianceX === 0 || varianceY === 0) return { ...unavailable('zero-variance'), observations };
  return { ...available(Math.max(-1, Math.min(1, covariance / Math.sqrt(varianceX * varianceY)))), observations };
}

/** Public weight inputs are percentages, never fractional weights.
 * Accept up to 0.01 percentage points of UI rounding and normalise explicitly.
 */
export function normaliseWeights(weights: Weight[], teamIds: string[]): { teamId: string; weight: number }[] {
  const allowed = new Set(teamIds);
  if (weights.length < 1 || weights.length > 10 || new Set(weights.map(w => w.teamId)).size !== weights.length) throw new Error('Select 1–10 unique teams');
  for (const entry of weights) {
    if (!allowed.has(entry.teamId) || !Number.isFinite(entry.percent) || entry.percent < 0 || entry.percent > 100) throw new Error('Invalid team or weight');
  }
  const total = weights.reduce((sum, entry) => sum + entry.percent, 0);
  if (Math.abs(total - 100) > 0.01 + 1e-10) throw new Error('Weights must total 100% (±0.01 percentage points)');
  return weights.map(entry => ({ teamId: entry.teamId, weight: entry.percent / total }));
}
export function portfolioWeeks(dataset: WeeklyDataset, weights: Weight[]): WeeklyChange[] {
  const normalised = normaliseWeights(weights, Object.keys(dataset.teams));
  return dataset.weeks.map((week, index) => ({
    week,
    change: normalised.reduce((sum, entry) => sum + entry.weight * dataset.teams[entry.teamId][index].change, 0),
    // Team-game exposures: opposing selected teams each count once; not unique fixtures.
    games: normalised.reduce((sum, entry) => sum + (entry.weight > 0 ? dataset.teams[entry.teamId][index].games : 0), 0),
  }));
}
/** All-team reference is calculated from source deltas (minor rounding may remain). */
export function benchmarkWeeks(dataset: WeeklyDataset): WeeklyChange[] {
  const teams = Object.values(dataset.teams);
  if (!teams.length) throw new Error('No teams available for benchmark');
  return dataset.weeks.map((week, index) => ({
    week,
    change: teams.reduce((sum, team) => sum + team[index].change, 0) / teams.length,
    games: teams.reduce((sum, team) => sum + team[index].games, 0) / 2,
  }));
}

/** First point is the baseline at interval start; weekly points represent
 * the final included date of their bucket. A one-day interval may have two
 * points on the same date (opening baseline then end-of-day observation).
 */
export function analyseSeries(series: WeeklyChange[], start: string, end: string): Analysis {
  const startTime = timestamp(start), endTime = timestamp(end);
  if (startTime > endTime) throw new Error('Invalid evaluation interval');
  const expected: string[] = [];
  for (let time = monday(startTime); time <= monday(endTime); time += 7 * DAY) expected.push(iso(time));
  if (series.length !== expected.length || series.some((point, i) => point.week !== expected[i])) throw new Error('Series must cover the evaluation week grid');
  const values = series.map(point => point.change);
  finite(values);
  let index = 100, peak = 100, peakDate = start;
  const maxDrawdown = { magnitude: 0, peakDate: start, troughDate: start };
  const points: IndexPoint[] = [{ date: start, index: 100, drawdown: 0 }];
  for (const point of series) {
    index += point.change;
    const date = iso(Math.min(timestamp(point.week) + 6 * DAY, endTime));
    if (index > peak) { peak = index; peakDate = date; }
    const drawdown = index - peak;
    if (-drawdown > maxDrawdown.magnitude) Object.assign(maxDrawdown, { magnitude: -drawdown, peakDate, troughDate: date });
    points.push({ date, index, drawdown });
  }
  return {
    observations: values.length, totalChange: index - 100,
    meanChange: mean(values), volatility: sampleStandardDeviation(values), consistency: consistency(values), points, maxDrawdown
  };
}
