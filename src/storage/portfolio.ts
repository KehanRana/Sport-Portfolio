import { z } from 'zod';
import { ANALYTICS_VERSION, normaliseWeights } from '../analytics/engine';
import type { Manifest } from '../data/schema';
export const STORAGE_KEY = 'courtfolio.portfolio.v1';
export const savedSchema = z.object({ schemaVersion: z.literal(1), analyticsVersion: z.literal(ANALYTICS_VERSION), sourceSha256: z.string(), season: z.string(), start: z.iso.date(), end: z.iso.date(), comparison: z.array(z.string()).max(5), weights: z.array(z.object({ teamId: z.string(), percent: z.number().finite().min(0).max(100) })).min(1).max(10) });
export type SavedPortfolio = z.infer<typeof savedSchema>;
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function validateSaved(value: unknown, manifest: Manifest): SavedPortfolio {
  const saved = savedSchema.parse(value);
  const summary = manifest.seasons.find(s => s.season === saved.season);
  if (!summary || saved.sourceSha256 !== manifest.sourceSha256 || saved.start < summary.start || saved.end > summary.end || saved.start > saved.end) throw new Error('Saved dataset or interval is unavailable');
  const ids = Object.keys(summary.teamGameCounts);
  normaliseWeights(saved.weights, ids);
  if (new Set(saved.comparison).size !== saved.comparison.length || saved.comparison.some(id => !ids.includes(id))) throw new Error('Invalid saved comparison');
  return saved;
}
export function restorePortfolio(manifest: Manifest, getStorage: () => StoragePort = () => localStorage): { saved: SavedPortfolio | null; message: string } {
  try {
    const text = getStorage().getItem(STORAGE_KEY);
    if (!text) return { saved: null, message: 'No saved portfolio yet.' };
    try { return { saved: validateSaved(JSON.parse(text), manifest), message: 'Restored your saved portfolio.' }; }
    catch { return { saved: null, message: 'Saved portfolio is invalid or outdated. Using defaults; save again to replace it.' }; }
  } catch { return { saved: null, message: 'Browser storage is unavailable. You can continue in memory.' }; }
}
export function savePortfolio(value: SavedPortfolio, manifest: Manifest, getStorage: () => StoragePort = () => localStorage): string {
  try { const saved = validateSaved(value, manifest); getStorage().setItem(STORAGE_KEY, JSON.stringify(saved)); return 'Portfolio saved on this browser. Unapplied weight edits are not saved.'; }
  catch { return 'Could not save this portfolio. Browser storage may be unavailable or full; your analysis remains in memory.'; }
}
export function clearPortfolio(getStorage: () => StoragePort = () => localStorage): string {
  try { getStorage().removeItem(STORAGE_KEY); return 'Saved portfolio cleared. Default analysis restored.'; }
  catch { return 'Could not clear browser storage. Defaults restored in memory; the previous save may return after refresh.'; }
}
