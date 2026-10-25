import { manifestSchema, seasonSchema, type SeasonSummary } from './schema';
const base = `${import.meta.env.BASE_URL}data/`;
async function getJson(file: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${base}${file}`, { signal });
  if (!response.ok) throw new Error(`Could not load ${file} (HTTP ${response.status}).`);
  return response.json();
}
export async function loadManifest(signal: AbortSignal) {
  return manifestSchema.parse(await getJson('manifest.json', signal));
}
export async function loadSeason(summary: SeasonSummary, signal: AbortSignal) {
  const season = seasonSchema.parse(await getJson(summary.file, signal));
  if (season.season !== summary.season || season.games.length !== summary.games) throw new Error('Season data does not match the manifest.');
  const counts = new Map<string, number>();
  const ids = new Set<string>();
  for (const game of season.games) {
    if (ids.has(game.id) || game.home.id === game.away.id || game.season !== Number(summary.season.slice(0, 4)) + 1 || game.date < summary.start || game.date > summary.end) throw new Error('Season contains inconsistent game records.');
    ids.add(game.id);
    for (const team of [game.home, game.away]) counts.set(team.id, (counts.get(team.id) ?? 0) + 1);
  }
  if (counts.size !== summary.teams || Object.keys(summary.teamGameCounts).length !== counts.size || [...counts].some(([id, count]) => summary.teamGameCounts[id] !== count)) throw new Error('Team coverage does not match the manifest.');
  return season;
}
