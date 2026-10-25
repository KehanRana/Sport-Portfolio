import { aggregateWeeks, analyseSeries } from './engine';
import type { Season } from '../data/schema';
import { buildTeamRows } from '../data/teams';
export function exploreSeason(season: Season, start: string, end: string) {
  const weekly = aggregateWeeks(season, start, end);
  const filtered = { ...season, games: season.games.filter(g => g.date >= start && g.date <= end) };
  const records = new Map(buildTeamRows(filtered).map(team => [team.id, team]));
  const teams = buildTeamRows(season).map(team => ({ ...team, ...(records.get(team.id) ?? { games: 0, wins: 0, losses: 0 }), analysis: analyseSeries(weekly.teams[team.id], start, end) }));
  return { weekly, teams };
}
export type ExploredTeam = ReturnType<typeof exploreSeason>['teams'][number];
export function validateRange(start: string, end: string, min: string, max: string): string | null {
  if (!start || !end) return 'Choose both dates.';
  if (start < min || start > max || end < min || end > max) return 'Choose dates within this season.';
  if (start > end) return 'Start date must be on or before end date.';
  return null;
}
