import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadManifest, loadSeason } from './load';
import { manifestSchema } from './schema';
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../public/data/${name}`, import.meta.url), 'utf8'));
const summary = manifestSchema.parse(read('manifest.json')).seasons[2];
const signal = () => new AbortController().signal;
afterEach(() => vi.unstubAllGlobals());
describe('validated HTTP loading', () => {
  it('loads a valid season through the loader', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(read(summary.file)))));
    expect((await loadSeason(summary, signal())).games).toHaveLength(1230);
  });
  it('reports HTTP errors rather than reading invalid responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', {status:404})));
    await expect(loadManifest(signal())).rejects.toThrow('HTTP 404');
  });
  it('rejects duplicate game IDs even when the total count is unchanged', async () => {
    const season = read(summary.file);
    season.games[1] = season.games[0];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(season))));
    await expect(loadSeason(summary, signal())).rejects.toThrow('inconsistent game records');
  });
  it('rejects a dataset from the wrong season', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(read('2012-13.json')))));
    await expect(loadSeason(summary, signal())).rejects.toThrow('does not match the manifest');
  });
});
