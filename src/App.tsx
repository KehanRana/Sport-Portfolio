import { useEffect, useMemo, useState } from 'react';
import { loadManifest, loadSeason } from './data/load';
import { buildTeamRows } from './data/teams';
import Exploration from './components/Exploration';
import type { Manifest, Season, SeasonSummary } from './data/schema';

type LoadState<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };
const formatNumber = new Intl.NumberFormat('en-AU');
function formatDate(date: string) { return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)); }
function LoadMessage({ state, retry }: { state: 'loading' | 'error'; retry: () => void }) {
  return <div className="load-message" role={state === 'error' ? 'alert' : 'status'}><span className="status-dot" />{state === 'loading' ? 'Loading historical season…' : <>We couldn’t load this dataset. Check your connection and try again. <button onClick={retry}>Retry</button></>}</div>;
}
function SeasonBrowser({ summary }: { summary: SeasonSummary }) {
  const [state, setState] = useState<LoadState<Season>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    loadSeason(summary, controller.signal).then(data => setState({ status: 'ready', data })).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({ status: 'error', message: error instanceof Error ? error.message : 'Invalid season data' });
    });
    return () => controller.abort();
  }, [summary, attempt]);
  const teams = useMemo(() => state.status === 'ready' ? buildTeamRows(state.data) : [], [state]);
  if (state.status !== 'ready') return <><LoadMessage state={state.status} retry={() => setAttempt(value => value + 1)} />{state.status === 'error' ? <p className="error-detail">{state.message}</p> : null}</>;
  return <>
    <section className="stats" aria-label="Season overview">
      <article><span className="eyebrow">THE UNIVERSE</span><strong>{teams.length}<small> teams</small></strong><p>Teams in this season’s dataset.</p></article>
      <article><span className="eyebrow">FULL-SEASON DATASET</span><strong>{formatNumber.format(state.data.games.length)}</strong><p>Validated, with every matchup counted once.</p></article>
      <article><span className="eyebrow">DATASET COVERAGE</span><strong className="date-stat">{formatDate(summary.start).replace(/ \d{4}$/, '')} <span>→</span> {formatDate(summary.end).replace(/ \d{4}$/, '')}</strong><p>{summary.season.slice(0, 4)}–{Number(summary.season.slice(0, 4)) + 1} · Regular season only</p></article>
    </section>
    <div className="workspace">
      <Exploration season={state.data} summary={summary} />
      <aside className="sidebar">
        <section className="idea-panel"><span className="eyebrow">A NEW LENS ON THE GAME</span><div className="court" aria-hidden="true"><div className="court-circle"/><div className="court-line"/></div><h2>Think like a fan.<br/>Explore like an analyst.</h2><p>Which teams improve? Which stay consistent? What happens when you put them together?</p><p className="idea-note">Compare teams, choose your allocation and replay its historical performance.</p></section>
        <section className="source-panel"><div className="source-top"><span className="eyebrow">KNOW YOUR DATA</span><span className="verified">✓ Validated</span></div><h3>History, with context.</h3><p>Published FiveThirtyEight Elo and game results. This is a historical snapshot, not live NBA coverage.</p><dl><div><dt>Coverage</dt><dd>2012–2015</dd></div><div><dt>Source</dt><dd>FiveThirtyEight</dd></div><div><dt>Licence</dt><dd>CC BY 4.0</dd></div></dl>{summary.season === '2012-13' ? <p className="coverage-note">Boston and Indiana played 81 games each. Their April 16 matchup was cancelled and not rescheduled.</p> : null}<a href="https://github.com/fivethirtyeight/data/tree/master/nba-elo" target="_blank" rel="noreferrer">Explore the original dataset <span aria-hidden="true">↗</span></a></section>
      </aside>
    </div>
  </>;
}
export default function App() {
  const [manifest, setManifest] = useState<LoadState<Manifest>>({ status: 'loading' });
  const [selected, setSelected] = useState('2014-15');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setManifest({ status: 'loading' });
    loadManifest(controller.signal).then(data => { setManifest({ status: 'ready', data }); setSelected(current => data.seasons.some(s => s.season === current) ? current : data.seasons[data.seasons.length - 1].season); }).catch((error: unknown) => { if (!controller.signal.aborted) setManifest({ status: 'error', message: error instanceof Error ? error.message : 'Invalid manifest' }); });
    return () => controller.abort();
  }, [attempt]);
  const summary = manifest.status === 'ready' ? manifest.data.seasons.find(s => s.season === selected) : undefined;
  return <><a className="skip-link" href="#main">Skip to content</a><header className="header"><a className="brand" href="./" aria-label="Courtfolio home"><span className="brand-mark" aria-hidden="true">c.</span>courtfolio</a><div className="header-label">THE NBA PORTFOLIO LAB</div><span className="build-label"><span/>STAGE 04 · PORTFOLIO</span></header><main id="main"><div className="hero"><div><div className="hero-kicker"><span/>SPORTS, THROUGH A DIFFERENT LENS</div><h1>Beyond the <em>box score.</em></h1><p>See NBA teams as a universe of assets.<br className="mobile-break"/> Explore the history. Find your perspective.</p></div><div className="season-control"><label htmlFor="season">SELECT SEASON</label><select id="season" value={selected} disabled={manifest.status !== 'ready'} onChange={event => setSelected(event.target.value)}>{manifest.status === 'ready' ? [...manifest.data.seasons].reverse().map(s => <option key={s.season} value={s.season}>{s.season.replace('-', ' / ')}</option>) : <option value="2014-15">Loading…</option>}</select><span>NBA · REGULAR SEASON</span></div></div>{summary ? <SeasonBrowser key={summary.season} summary={summary} /> : <LoadMessage state={manifest.status === 'error' ? 'error' : 'loading'} retry={() => setAttempt(value => value + 1)} />}</main><footer><span className="footer-brand">courtfolio<span> / An independent analytics project</span></span><p>Data: <a href="https://github.com/fivethirtyeight/data/tree/master/nba-elo">FiveThirtyEight</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> · Filtered and transformed. <a href={`${import.meta.env.BASE_URL}data-sources.md`}>Transformation notes</a></p></footer></>;
}
