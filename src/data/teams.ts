import type { Season } from './schema';
const cities: Record<string, string> = { ATL:'Atlanta', BOS:'Boston', BRK:'Brooklyn', CHA:'Charlotte', CHO:'Charlotte', CHI:'Chicago', CLE:'Cleveland', DAL:'Dallas', DEN:'Denver', DET:'Detroit', GSW:'Golden State', HOU:'Houston', IND:'Indiana', LAC:'Los Angeles', LAL:'Los Angeles', MEM:'Memphis', MIA:'Miami', MIL:'Milwaukee', MIN:'Minnesota', NOH:'New Orleans', NOP:'New Orleans', NYK:'New York', OKC:'Oklahoma City', ORL:'Orlando', PHI:'Philadelphia', PHO:'Phoenix', POR:'Portland', SAC:'Sacramento', SAS:'San Antonio', TOR:'Toronto', UTA:'Utah', WAS:'Washington' };
export function buildTeamRows(season: Season) {
  const teams = new Map<string, { id: string; name: string; games: number; wins: number; losses: number }>();
  for (const game of season.games) {
    for (const [team, opponent] of [[game.home, game.away], [game.away, game.home]]) {
      const name = team.id === 'CHA' ? 'Bobcats' : team.id === 'CHO' || team.id === 'NOH' ? 'Hornets' : team.franchise;
      const row = teams.get(team.id) ?? { id: team.id, name: `${cities[team.id] ?? team.id} ${name}`, games: 0, wins: 0, losses: 0 };
      row.games += 1;
      if (team.score > opponent.score) row.wins += 1; else row.losses += 1;
      teams.set(team.id, row);
    }
  }
  return [...teams.values()].sort((a, b) => a.name.localeCompare(b.name));
}
