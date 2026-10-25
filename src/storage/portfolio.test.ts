import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { manifestSchema } from '../data/schema';
import { ANALYTICS_VERSION } from '../analytics/engine';
import { clearPortfolio, restorePortfolio, savePortfolio, validateSaved, type SavedPortfolio } from './portfolio';
const manifest = manifestSchema.parse(JSON.parse(readFileSync(new URL('../../public/data/manifest.json', import.meta.url), 'utf8')));
const saved: SavedPortfolio = { schemaVersion: 1, analyticsVersion: ANALYTICS_VERSION, sourceSha256: manifest.sourceSha256, season: '2012-13', start: '2012-11-01', end: '2013-03-01', comparison: ['BOS', 'GSW'], weights: [{ teamId: 'BOS', percent: 75 }, { teamId: 'GSW', percent: 25 }] };
function memory(initial: string | null = null) { let value = initial; return { getItem: () => value, setItem: (_key: string, text: string) => { value = text; }, removeItem: () => { value = null; } }; }
describe('portfolio persistence', () => {
  it('roundtrips season, range, comparisons and applied weights', () => { const storage = memory(); expect(savePortfolio(saved, manifest, () => storage)).toMatch('saved'); expect(restorePortfolio(manifest, () => storage).saved).toEqual(saved); });
  it('recovers from absent or malformed saved state', () => { expect(restorePortfolio(manifest, () => memory()).saved).toBeNull(); const result = restorePortfolio(manifest, () => memory('{oops')); expect(result.saved).toBeNull(); expect(result.message).toMatch('invalid'); });
  it('rejects stale versions, source hashes and unsupported seasons', () => { for (const change of [{ schemaVersion: 2 }, { analyticsVersion: '0.0.0' }, { sourceSha256: 'old' }, { season: '2025-26' }]) expect(() => validateSaved({ ...saved, ...change }, manifest)).toThrow(); });
  it('rejects bad dates, duplicate/unknown teams and invalid totals', () => { for (const change of [{ start: '2012-02-30' }, { start: '2010-01-01' }, { start: '2013-04-01', end: '2013-03-01' }, { comparison: ['BOS', 'BOS'] }, { comparison: ['CHO'] }, { weights: [{ teamId: 'BOS', percent: 99 }] }, { weights: [{ teamId: 'CHO', percent: 100 }] }]) expect(() => validateSaved({ ...saved, ...change }, manifest)).toThrow(); });
  it('handles blocked storage on read and write without crashing', () => { const blocked = () => { throw new Error('SecurityError'); }; expect(restorePortfolio(manifest, blocked).message).toMatch('unavailable'); expect(savePortfolio(saved, manifest, blocked)).toMatch('Could not save'); expect(clearPortfolio(blocked)).toMatch('Could not clear'); });
  it('handles quota failures without destroying previous save', () => { const storage = memory(JSON.stringify(saved)); storage.setItem = () => { throw new Error('QuotaExceededError'); }; expect(savePortfolio(saved, manifest, () => storage)).toMatch('Could not save'); expect(restorePortfolio(manifest, () => storage).saved).toEqual(saved); });
  it('clears only the application save', () => { const storage = memory(JSON.stringify(saved)); expect(clearPortfolio(() => storage)).toMatch('cleared'); expect(restorePortfolio(manifest, () => storage).saved).toBeNull(); });
});
