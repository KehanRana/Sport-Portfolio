import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { seasonSchema } from '../data/schema';
import { exploreSeason, validateRange } from './exploration';
const season=seasonSchema.parse(JSON.parse(readFileSync(new URL('../../public/data/2014-15.json',import.meta.url),'utf8')));
describe('exploration view model',()=>{
  it('updates records and analytics to the same inclusive interval',()=>{
    const result=exploreSeason(season,'2014-10-28','2014-10-28');
    const warriors=result.teams.find(t=>t.id==='GSW')!;
    expect(result.teams).toHaveLength(30);
    expect(warriors.games).toBe(0);
    expect(warriors.analysis.totalChange).toBe(0);
    expect(warriors.analysis.volatility.value).toBeNull();
    const games=season.games.filter(g=>g.date==='2014-10-28');
    expect(result.teams.reduce((sum,t)=>sum+t.games,0)).toBe(games.length*2);
    expect(result.teams.reduce((sum,t)=>sum+t.wins,0)).toBe(games.length);
  });
  it('supports a no-game interval without dropping teams',()=>{
    const result=exploreSeason(season,'2015-02-16','2015-02-16');
    expect(result.teams).toHaveLength(30);
    expect(result.teams.every(t=>t.games===0&&t.analysis.totalChange===0)).toBe(true);
  });
  it('validates draft dates without overwriting the active interval',()=>{
    expect(validateRange('','','2014-10-28','2015-04-15')).toBeTruthy();
    expect(validateRange('2015-03-01','2015-02-01','2014-10-28','2015-04-15')).toMatch('Start date');
    expect(validateRange('2014-10-01','2015-02-01','2014-10-28','2015-04-15')).toMatch('within');
    expect(validateRange('2014-10-28','2015-04-15','2014-10-28','2015-04-15')).toBeNull();
  });
});
