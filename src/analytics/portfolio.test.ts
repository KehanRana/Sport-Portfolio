import { describe, expect, it } from 'vitest';
import { equalWeights, replayPortfolio, validatePortfolio } from './portfolio';
import type { WeeklyDataset } from './engine';
const data:WeeklyDataset={start:'2024-01-01',end:'2024-01-14',weeks:['2024-01-01','2024-01-08'],teams:{A:[{week:'2024-01-01',change:10,games:1},{week:'2024-01-08',change:-20,games:1}],B:[{week:'2024-01-01',change:-10,games:1},{week:'2024-01-08',change:20,games:1}]}};
describe('portfolio builder contract',()=>{
  it('handles blank, nonnumeric and incomplete allocation drafts',()=>{
    for(const value of ['', ' ', 'abc','Infinity','-1','101','99']) expect(validatePortfolio([{teamId:'A',value}],['A']).error).not.toBeNull();
    expect(validatePortfolio([],['A']).error).not.toBeNull();
    expect(validatePortfolio([{teamId:'X',value:'100'}],['A']).error).not.toBeNull();
  });
  it('accepts valid weights and source rounding tolerance',()=>{
    expect(validatePortfolio([{teamId:'A',value:'100'}],['A']).weights).toEqual([{teamId:'A',percent:100}]);
    expect(validatePortfolio([{teamId:'A',value:'99.99'}],['A']).error).toBeNull();
  });
  it('allocates exact displayed equal weights for every supported basket size',()=>{
    for(let count=1;count<=10;count++){
      const ids=Array.from({length:count},(_,i)=>String(i));
      const equal=equalWeights(ids);
      expect(equal.reduce((sum,w)=>sum+Number(w.value),0)).toBeCloseTo(100,8);
      expect(validatePortfolio(equal,ids).error).toBeNull();
    }
    expect(equalWeights(['A','B','C']).map(w=>w.value)).toEqual(['33.34','33.33','33.33']);
    expect(equalWeights([])).toEqual([]);
  });
  it('replays fixed allocations with a reference, baseline and drawdown',()=>{
    const result=replayPortfolio(data,[{teamId:'A',percent:75},{teamId:'B',percent:25}]);
    expect(result.portfolio.points.map(p=>p.index)).toEqual([100,105,95]);
    expect(result.benchmark.points.map(p=>p.index)).toEqual([100,100,100]);
    expect(result.portfolio.maxDrawdown).toEqual({magnitude:10,peakDate:'2024-01-07',troughDate:'2024-01-14'});
    expect(result.portfolio.consistency.value).toBeNull();
  });
  it('recomputes applied exposures against changed interval data without mutating input',()=>{
    const weights=[{teamId:'A',percent:100}];
    const before=JSON.stringify({data,weights});
    const first=replayPortfolio(data,weights);
    const short={...data,end:'2024-01-07',weeks:data.weeks.slice(0,1),teams:Object.fromEntries(Object.entries(data.teams).map(([id,series])=>[id,series.slice(0,1)]))};
    expect(replayPortfolio(short,weights).portfolio.points.at(-1)!.index).toBe(110);
    expect(first.portfolio.points.at(-1)!.index).toBe(90);
    expect(JSON.stringify({data,weights})).toBe(before);
  });
});
