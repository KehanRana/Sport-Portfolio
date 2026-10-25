import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line } from 'd3-shape';
import type { ExploredTeam } from '../analytics/exploration';
import type { Analysis, Metric, Weight, WeeklyDataset } from '../analytics/engine';
import { equalWeights, replayPortfolio, validatePortfolio, type DraftWeight } from '../analytics/portfolio';
const defaults:Weight[]=[{teamId:'GSW',percent:50},{teamId:'CLE',percent:50}];
const number=(value:number)=>value.toFixed(2);
const metric=(value:Metric)=>value.value===null?`N/A (${value.reason==='zero-variance'?'zero variance':'insufficient weeks'})`:number(value.value);
export default function Portfolio({dataset,teams}:{dataset:WeeklyDataset;teams:ExploredTeam[]}){
  const [draft,setDraft]=useState<DraftWeight[]>(()=>defaults.map(w=>({teamId:w.teamId,value:String(w.percent)})));
  const [applied,setApplied]=useState(defaults);
  const [candidate,setCandidate]=useState('');
  const [notice,setNotice]=useState('Example portfolio: 50% Golden State and 50% Cleveland.');
  const [cursor,setCursor]=useState(0);
  const validation=validatePortfolio(draft,teams.map(t=>t.id));
  const replay=useMemo(()=>replayPortfolio(dataset,applied),[dataset,applied]);
  const available=teams.filter(t=>!draft.some(w=>w.teamId===t.id));
  const choice=available.some(t=>t.id===candidate)?candidate:available[0]?.id??'';
  const total=draft.reduce((sum,w)=>sum+(Number.isFinite(Number(w.value))?Number(w.value):0),0);
  const dirty=JSON.stringify(draft.map(w=>({teamId:w.teamId,percent:Number(w.value)})))!==JSON.stringify(applied)||draft.some(w=>w.value==='');
  const position=Math.min(cursor,replay.weekly.length-1);
  const selectedWeek=replay.weekly[position];
  const reset=()=>{setDraft(defaults.map(w=>({teamId:w.teamId,value:String(w.percent)})));setApplied(defaults);setCursor(0);setNotice('Reset to the example portfolio.');};
  return <section className="chart-panel portfolio-panel" aria-labelledby="portfolio-title">
    <div className="panel-heading"><div><span className="eyebrow">03 / BUILD YOUR PORTFOLIO</span><h2 id="portfolio-title">Your teams. Your allocation.</h2><p>Fixed exposures · synthetic index points · retrospective historical replay</p></div></div>
    <form className="portfolio-builder" noValidate onSubmit={event=>{event.preventDefault();if(validation.weights){setApplied(validation.weights);setCursor(0);setNotice('Portfolio replay updated.');}}}>
      <div className="portfolio-add"><label htmlFor="portfolio-team">Choose a portfolio team<select id="portfolio-team" value={choice} disabled={draft.length>=10} onChange={e=>setCandidate(e.target.value)}>{available.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button type="button" disabled={draft.length>=10||!choice} onClick={()=>{setDraft([...draft,{teamId:choice,value:'0'}]);setNotice('Team added with zero weight. Set allocations, then replay.');}}>Add team</button></div>
      <p className="portfolio-hint">{draft.length}/10 teams · Separate from your comparison selections. Changing season resets this portfolio.</p>
      <div className="weight-list">{draft.map(entry=><div className="weight-row" key={entry.teamId}><label htmlFor={`weight-${entry.teamId}`}>{teams.find(t=>t.id===entry.teamId)?.name}<small>{entry.teamId}</small></label><div className="weight-input"><input id={`weight-${entry.teamId}`} aria-label={`Weight for ${teams.find(t=>t.id===entry.teamId)?.name} (%)`} type="number" inputMode="decimal" min="0" max="100" step="0.01" value={entry.value} onInput={e=>{const value=e.currentTarget.value;setDraft(current=>current.map(w=>w.teamId===entry.teamId?{...w,value}:w));}}/><span>%</span></div><button type="button" aria-label={`Remove ${teams.find(t=>t.id===entry.teamId)?.name} from portfolio`} onClick={()=>setDraft(current=>current.filter(w=>w.teamId!==entry.teamId))}>Remove</button></div>)}</div>
      <div className="weight-total"><strong>Total allocation: {number(total)}%</strong><span>{validation.error??'Valid allocation'}</span></div>
      {validation.error?<p className="allocation-error" role="status">{validation.error} Replay is disabled; previous results remain below.</p>:null}
      <div className="portfolio-actions"><button type="submit" className="primary" disabled={!!validation.error}>Replay portfolio</button><button type="button" disabled={!draft.length} onClick={()=>{setDraft(equalWeights(draft.map(w=>w.teamId)));setNotice('Equal weights set. Replay to apply.');}}>Equal weight</button><button type="button" onClick={reset}>Reset portfolio</button></div>
      <p className="portfolio-hint">Totals within 0.01 percentage points of 100% are accepted and normalised to exactly 100% for calculation. Equal weighting distributes rounding across teams.</p>
      <p role="status" className="portfolio-notice">{notice}{dirty?' Unapplied edits: charts still use the last replayed allocation.':''}</p>
    </form>
    <div className="replay-heading"><h3>Historical replay</h3><p>{dataset.start} to {dataset.end} · {dataset.weeks.length} weeks · Dates follow the evaluation window above.</p><p>Applied weights: {replay.weights.map(w=>`${w.teamId} ${number(w.weight*100)}%`).join(' · ')}</p></div>
    <div className="portfolio-metrics" role="region" aria-label="Portfolio replay statistics">
      <article><span>Final index</span><strong>{number(replay.portfolio.points.at(-1)!.index)}</strong><small>Starts at 100 · {number(replay.portfolio.totalChange)} point change</small></article>
      <article><span>Weekly volatility</span><strong>{metric(replay.portfolio.volatility)}</strong><small>Sample standard deviation · Elo points</small></article>
      <article><span>Consistency</span><strong>{metric(replay.portfolio.consistency)}</strong><small>Mean / volatility · unannualised</small></article>
      <article><span>Maximum drawdown</span><strong>{number(replay.portfolio.maxDrawdown.magnitude)} pts</strong><small>Peak {replay.portfolio.maxDrawdown.peakDate}<br/>Trough {replay.portfolio.maxDrawdown.troughDate}</small></article>
    </div>
    <div className="portfolio-chart-heading"><h3>Performance versus the neutral reference</h3><p><span className="line-key"/>Portfolio <span className="line-key benchmark-key"/>All-team equal-weight reference</p></div>
    <ReplayChart portfolio={replay.portfolio} benchmark={replay.benchmark} position={position} drawdown={false}/>
    <div className="portfolio-chart-heading"><h3>Drawdown from the running peak</h3><p>Index points below the weekly high-water mark, including the initial 100 baseline.</p></div>
    <ReplayChart portfolio={replay.portfolio} benchmark={replay.benchmark} position={position} drawdown/>
    <label className="week-control">Inspect portfolio week starting {selectedWeek.week}<input aria-label="Portfolio inspection week" type="range" min="0" max={replay.weekly.length-1} value={position} onChange={e=>setCursor(Number(e.target.value))}/></label>
    <p className="weekly-details" aria-live="polite">Week of {selectedWeek.week}: index {number(replay.portfolio.points[position+1].index)} · change {number(selectedWeek.change)} Elo points · drawdown {number(replay.portfolio.points[position+1].drawdown)} points · {selectedWeek.games} team-game exposures</p>
    <details className="data-alternative"><summary>View portfolio replay data</summary><div className="table-scroll" role="region" aria-label="Portfolio replay data" tabIndex={0}><table><caption>Opening baseline 100; each row is the end of an included calendar-week bucket.</caption><thead><tr><th>Week starting</th><th>Portfolio index</th><th>Elo change</th><th>Reference index</th><th>Drawdown points</th><th>Team-game exposures</th></tr></thead><tbody>{replay.weekly.map((w,i)=><tr key={w.week}><th scope="row">{w.week}</th><td>{number(replay.portfolio.points[i+1].index)}</td><td>{number(w.change)}</td><td>{number(replay.benchmark.points[i+1].index)}</td><td>{number(replay.portfolio.points[i+1].drawdown)}</td><td>{w.games}</td></tr>)}</tbody></table></div></details>
    <div className="portfolio-footnote"><p>This is a retrospective simulation of rating changes, not betting profit or investment returns. Weights stay fixed; performance is additive. The all-team reference is theoretically flat because Elo changes cancel, with tiny residuals from source rounding.</p><p>Idle weeks count as zero change. Partial boundary weeks remain observations. Weekly drawdowns can miss larger declines within a week. Team-game exposures count each positive-weight selected team's games; a matchup between two selected teams counts twice. {replay.portfolio.maxDrawdown.magnitude===0?'No decline: peak and trough dates use the interval start.':''}</p></div>
  </section>;
}
function ReplayChart({portfolio,benchmark,position,drawdown}:{portfolio:Analysis;benchmark:Analysis;position:number;drawdown:boolean}){
  const w=900,h=260,left=65,right=28,top=20,bottom=45;
  const value=(p:Analysis['points'][number])=>drawdown?p.drawdown:p.index;
  const values=(drawdown?portfolio.points:[...portfolio.points,...benchmark.points]).map(value);
  const lo=Math.min(...values),hi=Math.max(...values),padding=Math.max(1,(hi-lo)*.1);
  const x=scaleLinear().domain([0,portfolio.points.length-1]).range([left,w-right]);
  const y=scaleLinear().domain([lo-padding,hi+padding]).nice().range([h-bottom,top]);
  const path=line<Analysis['points'][number]>().x((_,i)=>x(i)).y(p=>y(value(p)));
  const name=drawdown?'Portfolio drawdown chart':'Portfolio performance chart';
  return <div className="svg-wrap" role="region" tabIndex={0} aria-label={`Scrollable ${name.toLowerCase()}`}><svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${name}. Use the shared inspection slider or portfolio replay data table for exact values.`}>{y.ticks(5).map(tick=><g key={tick}><line x1={left} x2={w-right} y1={y(tick)} y2={y(tick)} stroke="#e0e5da"/><text x={left-10} y={y(tick)+4} textAnchor="end">{tick}</text></g>)}{!drawdown?<path d={path(benchmark.points)??''} fill="none" stroke="#9b7150" strokeWidth="2" strokeDasharray="6 4"/>:null}<path d={path(portfolio.points)??''} fill="none" stroke="#326347" strokeWidth="2.5"/><line x1={x(position+1)} x2={x(position+1)} y1={top} y2={h-bottom} stroke="#72846d" strokeDasharray="2 4"/><circle cx={x(position+1)} cy={y(value(portfolio.points[position+1]))} r="4" fill="#326347"/>{[0,Math.floor((portfolio.points.length-1)/2),portfolio.points.length-1].filter((v,i,a)=>a.indexOf(v)===i).map(i=><text key={i} x={x(i)} y={h-15} textAnchor="middle">{portfolio.points[i].date}</text>)}</svg></div>;
}
