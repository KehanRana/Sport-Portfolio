import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { seasonSchema, type Season } from '../data/schema';
import { aggregateWeeks, analyseSeries, benchmarkWeeks, consistency, correlation, mean, normaliseWeights, portfolioWeeks, sampleStandardDeviation, type WeeklyChange } from './engine';
const weeks = (values: number[]): WeeklyChange[] => values.map((change, i) => ({ week: new Date(Date.UTC(2024, 0, 1 + i * 7)).toISOString().slice(0, 10), change, games: 1 }));
const game = (id: string, date: string, delta: number, home = 'A', away = 'B'): Season['games'][number] => ({ id, date, season: 2024, neutralSite: false, home: { id: home, franchise: home, score: 100, eloBefore: 1500, eloAfter: 1500 + delta }, away: { id: away, franchise: away, score: 90, eloBefore: 1500, eloAfter: 1500 - delta } });
const fixture: Season = { schemaVersion: 1, season: '2023-24', games: [game('1', '2024-01-01', 10), game('2', '2024-01-07', -4), game('3', '2024-01-15', -8)] };
describe('weekly calendar aggregation', () => {
  it('groups Monday–Sunday games, sums same-week deltas and preserves idle weeks', () => {
    const data = aggregateWeeks(fixture, '2024-01-01', '2024-01-15');
    expect(data.weeks).toEqual(['2024-01-01', '2024-01-08', '2024-01-15']);
    expect(data.teams.A.map(w => [w.change, w.games])).toEqual([[6, 2], [0, 0], [-8, 1]]);
    expect(data.teams.B.map(w => w.change)).toEqual([-6, 0, 8]);
  });
  it('clips partial boundary weeks and starts a fresh display baseline', () => {
    const data = aggregateWeeks(fixture, '2024-01-07', '2024-01-15');
    expect(data.teams.A.map(w => w.change)).toEqual([-4, 0, -8]);
    const result = analyseSeries(data.teams.A, data.start, data.end);
    expect(result.points.map(p => p.index)).toEqual([100, 96, 96, 88]);
    expect(result.points.map(p => p.date)).toEqual(['2024-01-07', '2024-01-07', '2024-01-14', '2024-01-15']);
  });
  it('handles year boundaries and ignores input order', () => {
    const season = { ...fixture, games: [game('2', '2024-01-01', 2), game('1', '2023-12-31', 1)] };
    expect(aggregateWeeks(season, '2023-12-31', '2024-01-01').weeks).toEqual(['2023-12-25', '2024-01-01']);
  });
  it('rejects reversed, out-of-season and invalid calendar dates', () => {
    for (const [start, end] of [['2024-01-15', '2024-01-01'], ['2023-12-31', '2024-01-15'], ['2024-02-30', '2024-03-01']]) expect(() => aggregateWeeks(fixture, start, end)).toThrow();
  });
});
describe('summary statistics', () => {
  it('uses sample rather than population standard deviation', () => {
    expect(mean([1, 2, 3]).value).toBe(2);
    expect(sampleStandardDeviation([1, 2, 3]).value).toBe(1);
    expect(sampleStandardDeviation([3, 3]).value).toBe(0);
    expect(sampleStandardDeviation([3]).reason).toBe('insufficient-history');
    expect(mean([]).value).toBeNull();
  });
  it('calculates an unannualised consistency score with a 10-week minimum', () => {
    const values = Array.from({ length: 10 }, (_, i) => i + 1);
    expect(consistency(values).value).toBeCloseTo(5.5 / Math.sqrt(82.5 / 9), 8);
    expect(consistency(values.slice(1)).reason).toBe('insufficient-history');
    expect(consistency(Array(10).fill(0)).reason).toBe('zero-variance');
  });
  it('calculates positive and negative Pearson correlations with observation counts', () => {
    const values = Array.from({ length: 10 }, (_, i) => i);
    expect(correlation(weeks(values), weeks(values))).toEqual({ value: 1, reason: null, observations: 10 });
    expect(correlation(weeks(values), weeks(values.map(x => -x))).value).toBe(-1);
    expect(correlation(weeks(values), weeks(Array(10).fill(2))).reason).toBe('zero-variance');
    expect(correlation(weeks([1, 2]), weeks([2, 3])).reason).toBe('insufficient-history');
  });
  it('rejects mismatched grids and nonfinite inputs', () => {
    expect(() => correlation(weeks([1]), weeks([1, 2]))).toThrow();
    const shifted = weeks([1]); shifted[0].week = '2024-01-08';
    expect(() => correlation(weeks([1]), shifted)).toThrow();
    for (const fn of [mean, sampleStandardDeviation, consistency]) expect(() => fn([NaN])).toThrow();
  });
});
describe('portfolio and drawdown', () => {
  const data = aggregateWeeks(fixture, '2024-01-01', '2024-01-15');
  it('uses fixed exposures, including idle weeks, and additive performance', () => {
    const series = portfolioWeeks(data, [{ teamId: 'A', percent: 75 }, { teamId: 'B', percent: 25 }]);
    expect(series.map(w => w.change)).toEqual([3, 0, -4]);
    const result = analyseSeries(series, data.start, data.end);
    expect(result.points.map(p => p.index)).toEqual([100, 103, 103, 99]);
    expect(result.totalChange).toBe(-1);
    expect(result.maxDrawdown).toEqual({ magnitude: 4, peakDate: '2024-01-07', troughDate: '2024-01-15' });
  });
  it('includes the initial peak in drawdown and returns zero for rising series', () => {
    const falling = analyseSeries(weeks([-5, -2]), '2024-01-01', '2024-01-14');
    expect(falling.maxDrawdown).toEqual({ magnitude: 7, peakDate: '2024-01-01', troughDate: '2024-01-14' });
    expect(analyseSeries(weeks([2, 3]), '2024-01-01', '2024-01-14').maxDrawdown.magnitude).toBe(0);
    expect(analyseSeries(weeks([0, 0]), '2024-01-01', '2024-01-14').points.every(p => p.drawdown === 0)).toBe(true);
  });
  it('normalises rounded inputs and accepts zero-weight selections', () => {
    const result = normaliseWeights(['A', 'B', 'C'].map(teamId => ({ teamId, percent: 33.33 })), ['A', 'B', 'C']);
    expect(result.reduce((s, w) => s + w.weight, 0)).toBeCloseTo(1, 12);
    expect(portfolioWeeks(data, [{ teamId: 'A', percent: 100 }, { teamId: 'B', percent: 0 }]).map(w => w.change)).toEqual([6, 0, -8]);
  });
  it('rejects invalid totals, duplicates, unknown IDs, negative and nonfinite weights', () => {
    for (const weights of [[], [{ teamId: 'A', percent: 99 }], [{ teamId: 'A', percent: -1 }, { teamId: 'B', percent: 101 }], [{ teamId: 'X', percent: 100 }], [{ teamId: 'A', percent: NaN }], [{ teamId: 'A', percent: 50 }, { teamId: 'A', percent: 50 }]]) expect(() => normaliseWeights(weights, ['A', 'B'])).toThrow();
    expect(() => normaliseWeights(Array.from({ length: 11 }, (_, i) => ({ teamId: String(i), percent: 100 / 11 })), Array.from({ length: 11 }, (_, i) => String(i)))).toThrow();
  });
  it('does not accept series with omitted/reordered weeks', () => {
    expect(() => analyseSeries(weeks([1]), '2024-01-01', '2024-01-14')).toThrow();
  });
  it('computes the neutral all-team reference independently of portfolio size limits', () => {
    expect(benchmarkWeeks(data).map(w => w.change)).toEqual([0, 0, 0]);
  });
});
describe('real historical seasons', () => {
  for (const label of ['2012-13', '2013-14', '2014-15']) it(`conserves source deltas and game exposures in ${label}`, () => {
    const season = seasonSchema.parse(JSON.parse(readFileSync(new URL(`../../public/data/${label}.json`, import.meta.url), 'utf8')));
    const dates = season.games.map(g => g.date).sort();
    const data = aggregateWeeks(season, dates[0], dates[dates.length - 1]);
    expect(Object.keys(data.teams)).toHaveLength(30);
    expect(Object.values(data.teams).flat().reduce((s, w) => s + w.games, 0)).toBe(season.games.length * 2);
    for (const [id, series] of Object.entries(data.teams)) {
      const sourceTotal = season.games.reduce((s, g) => s + [g.home, g.away].filter(t => t.id === id).reduce((v, t) => v + t.eloAfter - t.eloBefore, 0), 0);
      expect(series.reduce((s, w) => s + w.change, 0)).toBeCloseTo(sourceTotal, 8);
      const result = analyseSeries(series, data.start, data.end);
      expect(result.points.every(p => Number.isFinite(p.index) && p.drawdown <= 0)).toBe(true);
    }
    // Published CSV has independently rounded Elo values; do not force exact zeros.
    expect(Math.abs(benchmarkWeeks(data).reduce((s, w) => s + w.change, 0))).toBeLessThan(.01);
  });
});
