import { analyseSeries, benchmarkWeeks, normaliseWeights, portfolioWeeks, type WeeklyDataset, type Weight } from './engine';
export interface DraftWeight {teamId:string;value:string}
export function validatePortfolio(draft:DraftWeight[],teamIds:string[]):{weights:Weight[];error:null}|{weights:null;error:string}{
  if(draft.some(entry=>entry.value.trim()==='')) return {weights:null,error:'Enter a weight for every selected team.'};
  const weights=draft.map(entry=>({teamId:entry.teamId,percent:Number(entry.value)}));
  try {normaliseWeights(weights,teamIds);return {weights,error:null};}
  catch(error){return {weights:null,error:error instanceof Error?error.message:'Invalid portfolio'};}
}
export function equalWeights(ids:string[]):DraftWeight[]{
  if(!ids.length)return [];
  // Allocate integer basis points so displayed percentages sum to exactly 100.
  const base=Math.floor(10000/ids.length),remainder=10000-base*ids.length;
  return ids.map((teamId,i)=>({teamId,value:((base+(i<remainder?1:0))/100).toFixed(2)}));
}
export function replayPortfolio(dataset:WeeklyDataset,weights:Weight[]){
  const weekly=portfolioWeeks(dataset,weights);
  return {weekly,portfolio:analyseSeries(weekly,dataset.start,dataset.end),benchmark:analyseSeries(benchmarkWeeks(dataset),dataset.start,dataset.end),weights:normaliseWeights(weights,Object.keys(dataset.teams))};
}
