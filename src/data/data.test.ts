import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { manifestSchema, seasonSchema } from './schema';
import { buildTeamRows } from './teams';
const read = (file: string): unknown => JSON.parse(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8'));
describe('historical data contract', () => {
  const manifest = manifestSchema.parse(read('manifest.json'));
  for (const summary of manifest.seasons) {
    it(`derives complete team records for ${summary.season}`, () => {
      const season = seasonSchema.parse(read(summary.file));
      const teams = buildTeamRows(season);
      expect(season.games).toHaveLength(summary.games);
      expect(teams).toHaveLength(30);
      expect(teams.reduce((sum, team) => sum + team.wins, 0)).toBe(summary.games);
      expect(teams.reduce((sum, team) => sum + team.losses, 0)).toBe(summary.games);
      for (const team of teams) expect(team.games).toBe(summary.teamGameCounts[team.id]);
    });
  }
  it('preserves historical Charlotte and New Orleans names', () => {
    const earlier = buildTeamRows(seasonSchema.parse(read('2012-13.json')));
    const later = buildTeamRows(seasonSchema.parse(read('2014-15.json')));
    expect(earlier.find(t => t.id === 'CHA')?.name).toBe('Charlotte Bobcats');
    expect(earlier.find(t => t.id === 'NOH')?.name).toBe('New Orleans Hornets');
    expect(later.find(t => t.id === 'CHO')?.name).toBe('Charlotte Hornets');
    expect(later.find(t => t.id === 'NOP')?.name).toBe('New Orleans Pelicans');
  });
  it('rejects unsupported schemas and invalid values', () => {
    expect(seasonSchema.safeParse({ schemaVersion: 2, season: '2014-15', games: [] }).success).toBe(false);
    const season = seasonSchema.parse(read('2014-15.json'));
    season.games[0].home.eloAfter = Infinity;
    expect(seasonSchema.safeParse(season).success).toBe(false);
  });
});
