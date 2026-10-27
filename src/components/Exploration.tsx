import { useChartScale } from "./charts/useChartScale";
import styles from "./Exploration.module.css";
import { bindClasses } from "../styles/classes";
const cx = bindClasses(styles);
import { useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import SeriesMarker from "./charts/SeriesMarker";
import Portfolio from "./Portfolio";
import {
  clearPortfolio,
  savePortfolio,
  type SavedPortfolio,
} from "../storage/portfolio";
import { ANALYTICS_VERSION, type Weight } from "../analytics/engine";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import type { Manifest, Season, SeasonSummary } from "../data/schema";
import {
  exploreSeason,
  validateRange,
  type ExploredTeam,
} from "../analytics/exploration";
import type { Metric } from "../analytics/engine";
const colours = [1, 2, 3, 4, 5].map((slot) => `var(--series-${slot})`);
const signed = (value: number) =>
  (value > 0 ? "↑ +" : value < 0 ? "↓ " : "") + value.toFixed(2);
const fmt = (value: number) => value.toFixed(2);
function metric(value: Metric) {
  return value.value === null ? "N/A" : fmt(value.value);
}
function reason(value: Metric) {
  return value.reason === "zero-variance"
    ? "Zero variance"
    : value.reason === "insufficient-history"
      ? "Insufficient weekly history"
      : undefined;
}
type SortKey = "name" | "change" | "volatility" | "consistency";
function sortValue(team: ExploredTeam, key: SortKey) {
  return key === "name"
    ? team.name
    : key === "change"
      ? team.analysis.totalChange
      : key === "volatility"
        ? team.analysis.volatility.value
        : team.analysis.consistency.value;
}
export default function Exploration({
  season,
  summary,
  manifest,
  saved,
  storageMessage,
}: {
  season: Season;
  summary: SeasonSummary;
  manifest: Manifest;
  saved: SavedPortfolio | null;
  storageMessage: string;
}) {
  const [range, setRange] = useState({
    start: saved?.start ?? summary.start,
    end: saved?.end ?? summary.end,
  });
  const [draft, setDraft] = useState(range);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(saved?.comparison ?? ["GSW", "CLE"]);
  const [detail, setDetail] = useState("GSW");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({
    key: "change",
    asc: false,
  });
  const [saveMessage, setSaveMessage] = useState(storageMessage);
  const [portfolioReset, setPortfolioReset] = useState(0);
  const [initialWeights, setInitialWeights] = useState(saved?.weights);
  function persist(weights: Weight[]) {
    setSaveMessage(
      savePortfolio(
        {
          schemaVersion: 1,
          analyticsVersion: ANALYTICS_VERSION,
          sourceSha256: manifest.sourceSha256,
          season: summary.season,
          start: range.start,
          end: range.end,
          comparison: selected,
          weights,
        },
        manifest,
      ),
    );
  }
  function clearSaved() {
    setSaveMessage(clearPortfolio());
    const full = { start: summary.start, end: summary.end };
    setRange(full);
    setDraft(full);
    setError(null);
    setSelected(["GSW", "CLE"]);
    setInitialWeights(undefined);
    setPortfolioReset((n) => n + 1);
    setCursor(null);
  }
  const [cursor, setCursor] = useState<number | null>(null);
  const data = useMemo(
    () => exploreSeason(season, range.start, range.end),
    [season, range],
  );
  const shown = data.teams
    .filter((t) =>
      `${t.name} ${t.id}`.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .sort((a, b) => {
      const x = sortValue(a, sort.key),
        y = sortValue(b, sort.key);
      if (x === null) return y === null ? a.name.localeCompare(b.name) : 1;
      if (y === null) return -1;
      const value =
        typeof x === "string" && typeof y === "string"
          ? x.localeCompare(y)
          : Number(x) - Number(y);
      return (sort.asc ? value : -value) || a.name.localeCompare(b.name);
    });
  const compared = selected
    .map((id) => data.teams.find((t) => t.id === id)!)
    .filter(Boolean);
  const active = data.teams.find((t) => t.id === detail)!;
  const observation =
    cursor === null
      ? data.weekly.weeks.length - 1
      : Math.min(cursor, data.weekly.weeks.length - 1);
  const week = data.weekly.weeks[observation];
  const games = season.games.filter(
    (g) =>
      g.date >= range.start &&
      g.date <= range.end &&
      g.date >= week &&
      g.date <=
        new Date(Date.parse(`${week}T00:00:00Z`) + 6 * 86400000)
          .toISOString()
          .slice(0, 10) &&
      selected.some((id) => g.home.id === id || g.away.id === id),
  );
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : current.length < 5
          ? [...current, id]
          : current,
    );
  }
  const changeSort = (key: SortKey) =>
    setSort((current) => ({
      key,
      asc: current.key === key ? !current.asc : key === "name",
    }));
  return (
    <div className={cx("exploration")}>
      {createPortal(
        <form
          className={cx("date-filter")}
          onSubmit={(event) => {
            event.preventDefault();
            const issue = validateRange(
              draft.start,
              draft.end,
              summary.start,
              summary.end,
            );
            setError(issue);
            if (!issue) {
              setRange(draft);
              setCursor(null);
            }
          }}
          noValidate
        >
          <label>
            From
            <input
              type="date"
              aria-invalid={!!error}
              aria-describedby={error ? "date-error" : undefined}
              min={summary.start}
              max={summary.end}
              value={draft.start}
              onInput={(e) =>
                setDraft({ ...draft, start: e.currentTarget.value })
              }
            />
          </label>
          <label>
            To
            <input
              type="date"
              aria-invalid={!!error}
              aria-describedby={error ? "date-error" : undefined}
              min={summary.start}
              max={summary.end}
              value={draft.end}
              onInput={(e) =>
                setDraft({ ...draft, end: e.currentTarget.value })
              }
            />
          </label>
          <button className={cx("primary")} type="submit">
            Apply dates
          </button>
          <button
            type="button"
            onClick={() => {
              const full = { start: summary.start, end: summary.end };
              setRange(full);
              setDraft(full);
              setError(null);
              setCursor(null);
            }}
          >
            Full season
          </button>
          {error ? (
            <p id="date-error" className={cx("filter-error")} role="alert">
              {error} Showing the last valid interval.
            </p>
          ) : null}
        </form>,
        document.getElementById("date-controls")!,
      )}
      <p className={cx("interval-note")} role="status">
        Active interval: {range.start} to {range.end} ;{" "}
        {
          season.games.filter(
            (g) => g.date >= range.start && g.date <= range.end,
          ).length
        }{" "}
        games; {data.weekly.weeks.length} calendar weeks. Boundary weeks may be
        partial.
        {summary.season === "2012-13"
          ? " Boston and Indiana each played 81 games after a cancelled matchup."
          : ""}
        {data.weekly.weeks.length < 10
          ? " Consistency needs at least 10 weeks."
          : ""}
      </p>
      <section className={cx("chart-panel")} aria-labelledby="comparison-title">
        <div className={cx("panel-heading")}>
          <div>
            <h2 id="comparison-title">Performance index</h2>
            <p>
              Synthetic units, starting at 100. Evaluation dates: {range.start}{" "}
              to {range.end}. n = {data.weekly.weeks.length} weeks
            </p>
          </div>
        </div>
        {compared.length ? (
          <>
            <Comparison
              teams={compared}
              onWeek={setCursor}
              observation={observation}
              start={range.start}
              end={range.end}
              weekly={data.weekly.teams}
            />
            <label className={cx("week-control")}>
              Inspect week starting {week}
              <input
                aria-label="Inspection week"
                type="range"
                min={0}
                max={data.weekly.weeks.length - 1}
                value={observation}
                onChange={(e) => setCursor(Number(e.target.value))}
              />
            </label>
            <div className={cx("weekly-details")}>
              <h3>Week of {week}</h3>
              {compared.map((team) => {
                const point = data.weekly.teams[team.id][observation];
                return (
                  <p key={team.id}>
                    <strong>{team.id}</strong>; {signed(point.change)} Elo
                    points; index{" "}
                    {fmt(team.analysis.points[observation + 1].index)} ;{" "}
                    {point.games} games{!point.games ? " (inactive)" : ""}
                  </p>
                );
              })}
              <details>
                <summary>Game results for this week ({games.length})</summary>
                {games.length ? (
                  <ul>
                    {games.map((g) => (
                      <li key={g.id}>
                        {g.date}; {g.away.id} {g.away.score} vs {g.home.id}{" "}
                        {g.home.score}
                        {g.neutralSite ? "; neutral site" : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No selected-team games in this interval and week.</p>
                )}
              </details>
            </div>
            <details className={cx("data-alternative")}>
              <summary>View as table</summary>
              <div
                className={cx("table-scroll")}
                role="region"
                aria-label="Weekly comparison data"
                tabIndex={0}
              >
                <table>
                  <caption>
                    Performance index at the end of each included week; opening
                    baseline is 100.
                  </caption>
                  <thead>
                    <tr>
                      <th>Week starting</th>
                      {compared.map((t) => (
                        <th key={t.id}>{t.id} index / Elo change / games</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.weekly.weeks.map((w, i) => (
                      <tr
                        key={w}
                        className={cx(i === observation ? "cursor-row" : "")}
                      >
                        <th scope="row">
                          {w}
                          {w < range.start ||
                          new Date(Date.parse(w + "T00:00:00Z") + 6 * 86400000)
                            .toISOString()
                            .slice(0, 10) > range.end
                            ? " (partial week)"
                            : ""}
                        </th>
                        {compared.map((t) => (
                          <td key={t.id}>
                            {fmt(t.analysis.points[i + 1].index)} /{" "}
                            {signed(data.weekly.teams[t.id][i].change)} /{" "}
                            {data.weekly.teams[t.id][i].games}
                            {data.weekly.teams[t.id][i].games === 0
                              ? " (inactive)"
                              : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <p className={cx("empty")}>
            No teams selected. Add up to five teams from the table to compare
            them.
          </p>
        )}
      </section>
      <section className={cx("chart-panel scatter-panel")}>
        <div className={cx("panel-heading")}>
          <div>
            <h2>Risk versus improvement</h2>
            <p>
              n = {data.weekly.weeks.length} weeks. Right = more weekly
              variation. Higher = greater mean weekly improvement. Choose a team
              to inspect it.
            </p>
          </div>
        </div>
        <Scatter
          teams={data.teams}
          active={detail}
          selected={selected}
          choose={setDetail}
        />
        <div className={cx("team-detail")} aria-live="polite">
          <h3>{active.name}</h3>
          <p>
            {active.games} games; n = {data.weekly.weeks.length} weeks; Elo
            change {fmt(active.analysis.totalChange)} ; weekly volatility{" "}
            {metric(active.analysis.volatility)} ; consistency{" "}
            {metric(active.analysis.consistency)}
          </p>
          <button
            disabled={!selected.includes(active.id) && selected.length === 5}
            onClick={() => toggle(active.id)}
          >
            {selected.includes(active.id)
              ? "Remove from comparison"
              : "Add to comparison"}
          </button>
        </div>
      </section>
      <Portfolio
        key={portfolioReset}
        dataset={data.weekly}
        teams={data.teams}
        initialWeights={initialWeights}
        onSave={persist}
        onClear={clearSaved}
        saveMessage={saveMessage}
      />
      <section className={cx("team-panel")} aria-labelledby="team-title">
        <div className={cx("panel-heading")}>
          <div>
            <h2 id="team-title">
              The team universe <span className={cx("count")}>30</span>
            </h2>
            <p>Select up to five teams. {selected.length}/5 selected.</p>
          </div>
          <label className={cx("search")}>
            <span className={cx("sr-only")}>Search teams</span>
            <input
              type="search"
              placeholder="Find a team…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <p className={cx("table-status")} role="status">
          {shown.length} of 30 teams; {range.start} to {range.end} ;{" "}
          {data.weekly.weeks.length} weeks
        </p>
        <div
          className={cx("table-scroll")}
          role="region"
          aria-label="Team metrics"
          tabIndex={0}
        >
          <table>
            <caption className={cx("sr-only")}>
              Team metrics for the selected interval. Elo and volatility are
              points; consistency is unannualised.
            </caption>
            <thead>
              <tr>
                <th>Compare</th>
                {(["name", "change", "volatility", "consistency"] as const).map(
                  (key) => (
                    <th
                      key={key}
                      aria-sort={
                        sort.key === key
                          ? sort.asc
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button onClick={() => changeSort(key)}>
                        {key === "name"
                          ? "Team"
                          : key === "change"
                            ? "Elo change"
                            : key === "volatility"
                              ? "Weekly volatility"
                              : "Consistency"}
                        {sort.key === key ? (sort.asc ? " ↑" : " ↓") : ""}
                      </button>
                    </th>
                  ),
                )}
                <th>Mean weekly change</th>
                <th>Games</th>
                <th>W–L</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((team) => (
                <tr
                  key={team.id}
                  className={cx(
                    selected.includes(team.id) ? "selected-row" : "",
                  )}
                >
                  <td>
                    <label className={cx("checkbox-target")}>
                      <input
                        type="checkbox"
                        aria-label={`Compare ${team.name}`}
                        checked={selected.includes(team.id)}
                        disabled={
                          !selected.includes(team.id) && selected.length === 5
                        }
                        onChange={() => toggle(team.id)}
                      />
                    </label>
                  </td>
                  <th scope="row">
                    <button
                      className={cx("team-link")}
                      onClick={() => setDetail(team.id)}
                    >
                      {team.name}
                      <small>{team.id}</small>
                    </button>
                  </th>
                  <td
                    data-trend={team.analysis.totalChange < 0 ? "loss" : "gain"}
                  >
                    {signed(team.analysis.totalChange)}
                  </td>
                  <td title={reason(team.analysis.volatility)}>
                    {metric(team.analysis.volatility)}
                    {team.analysis.volatility.value === null ? (
                      <small className={cx("metric-reason")}>
                        {reason(team.analysis.volatility)}
                      </small>
                    ) : null}
                  </td>
                  <td title={reason(team.analysis.consistency)}>
                    {metric(team.analysis.consistency)}
                    {team.analysis.consistency.value === null ? (
                      <small className={cx("metric-reason")}>
                        {reason(team.analysis.consistency)}
                      </small>
                    ) : null}
                  </td>
                  <td>{metric(team.analysis.meanChange)}</td>
                  <td>{team.games}</td>
                  <td>
                    {team.wins}–{team.losses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length ? (
            <div className={cx("empty")}>
              No matching teams.{" "}
              <button onClick={() => setSearch("")}>Clear search</button>
            </div>
          ) : null}
        </div>
      </section>
      <details className={cx("methodology")}>
        <summary>How to read these metrics</summary>
        <p>
          Weekly changes use published FiveThirtyEight Elo, grouped
          Monday–Sunday. Boundary weeks include only games within the selected
          dates and still count as observations. Idle weeks have zero change and
          zero games. A short interval can contain no games.
        </p>
        <p>
          Volatility is sample standard deviation (at least two weeks).
          Consistency is mean weekly change divided by volatility (at least ten
          weeks and nonzero variance); it is a Sharpe-style analogy with no
          annualisation. N/A means insufficient history or zero variance. See
          each team's history through the comparison table.
        </p>
        <p>
          The index adds Elo changes to 100; it is not money or percentage
          investment return. Season changes reset dates and comparison to Golden
          State and Cleveland. Charts describe historical performance, not
          predictions.
        </p>
      </details>
    </div>
  );
}
function Comparison({
  teams,
  onWeek,
  observation,
  start,
  end,
  weekly,
}: {
  teams: ExploredTeam[];
  onWeek: (index: number) => void;
  observation: number;
  start: string;
  end: string;
  weekly: Record<string, { week: string; games: number }[]>;
}) {
  const chart = useChartScale(900);
  const hatchId = useId().replace(/:/g, "");
  const width = 900,
    height = 300,
    left = 65,
    right = 150,
    top = 24,
    bottom = 48;
  const points = teams.flatMap((t) => t.analysis.points);
  const lo = Math.min(100, ...points.map((p) => p.index)),
    hi = Math.max(100, ...points.map((p) => p.index));
  const y = scaleLinear()
    .domain([lo - 10, hi + 10])
    .nice()
    .range([height - bottom, top]);
  // Ordinal observation positions preserve an opening baseline even on a repeated date.
  const x = scaleLinear()
    .domain([0, teams[0].analysis.points.length - 1])
    .range([left, width - right]);
  const labelPositions = new Map<string, number>();
  const sorted = [...teams].sort(
    (a, b) =>
      y(a.analysis.points.at(-1)!.index) - y(b.analysis.points.at(-1)!.index),
  );
  let previousLabel = top - 23;
  sorted.forEach((team) => {
    const next = Math.max(
      previousLabel + 23,
      y(team.analysis.points.at(-1)!.index),
    );
    labelPositions.set(team.id, next);
    previousLabel = next;
  });
  let nextLabel = height - bottom + 13;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const id = sorted[i].id;
    const label = Math.min(labelPositions.get(id)!, nextLabel - 23);
    labelPositions.set(id, label);
    nextLabel = label;
  }
  const draw = line<{ index: number }>()
    .x((_, i) => x(i))
    .y((p) => y(p.index));
  return (
    <div
      ref={chart.ref}
      style={chart.style}
      className={cx("svg-wrap")}
      role="region"
      tabIndex={0}
      aria-label="Scrollable comparison chart"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            onWeek(
              Math.max(
                0,
                Math.min(
                  teams[0].analysis.observations - 1,
                  observation + (e.key === "ArrowRight" ? 1 : -1),
                ),
              ),
            );
          }
        }}
        aria-label="Team performance comparison. Each line starts at 100; each line is directly labelled with its team and has a distinct dash pattern. Use the inspection slider or the data table for exact values."
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const i = Math.round(
            x.invert(((e.clientX - rect.left) / rect.width) * width),
          );
          onWeek(
            Math.max(0, Math.min(teams[0].analysis.observations - 1, i - 1)),
          );
        }}
      >
        <defs>
          <pattern
            id={hatchId}
            width="9"
            height="9"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(135)"
          >
            <rect width="9" height="9" fill="var(--panel)" />
            <rect
              width="2.5"
              height="9"
              fill="var(--paint)"
              fillOpacity="0.15"
            />
          </pattern>
        </defs>
        {teams[0].analysis.points.slice(1).map((point, i) => {
          const monday = new Date(point.date + "T00:00:00Z");
          monday.setUTCDate(
            monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7),
          );
          const week = weekly[teams[0].id][i].week;
          const partial =
            week < start ||
            new Date(Date.parse(week + "T00:00:00Z") + 6 * 86400000)
              .toISOString()
              .slice(0, 10) > end ||
            teams.some((team) => weekly[team.id][i].games === 0);
          return partial ? (
            <rect
              key={i}
              x={x(i)}
              y={top}
              width={x(i + 1) - x(i)}
              height={height - bottom - top}
              fill={`url(#${hatchId})`}
              opacity="0.5"
            />
          ) : null;
        })}
        {y.ticks(5).map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--court-line)"
            />
            <text x={left - 10} y={y(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        <line
          x1={left}
          x2={width - right}
          y1={y(100)}
          y2={y(100)}
          stroke="var(--court-line)"
          strokeWidth="1.5"
        />
        <text x={left + 20} y={y(100) - 10}>
          Start (100)
        </text>
        <line
          x1={x(observation + 1)}
          x2={x(observation + 1)}
          y1={top}
          y2={height - bottom}
          stroke="var(--ink)"
          strokeDasharray="2 4"
        />
        <rect
          x={left}
          y={top}
          width={width - right - left}
          height={height - bottom - top}
          fill="none"
          stroke="var(--court-line)"
        />
        <circle
          cx={left}
          cy={y(100)}
          r="13"
          fill="var(--panel)"
          stroke="var(--paint)"
          strokeWidth="1.5"
        />
        {teams.map((team, i) => (
          <g key={team.id}>
            <path
              d={draw(team.analysis.points) ?? ""}
              fill="none"
              stroke={colours[i]}
              strokeWidth="2.5"
              strokeDasharray={
                [undefined, "9 4", "3 4", "12 4 2 4", "6 3 2 3"][i]
              }
            />
            <SeriesMarker
              slot={i}
              x={width - right}
              y={y(team.analysis.points.at(-1)!.index)}
              color={colours[i]}
            />
            <line
              x1={width - right}
              y1={y(team.analysis.points.at(-1)!.index)}
              x2={width - right + 14}
              y2={labelPositions.get(team.id)! - 4}
              stroke={colours[i]}
            />
            <text
              x={width - right + 18}
              y={labelPositions.get(team.id)}
              fill={colours[i]}
            >
              {team.id} {fmt(team.analysis.points.at(-1)!.index)}
            </text>
          </g>
        ))}
        {[
          0,
          Math.floor((teams[0].analysis.points.length - 1) / 2),
          teams[0].analysis.points.length - 1,
        ]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((i) => (
            <text key={i} x={x(i)} y={height - 18} textAnchor="middle">
              {teams[0].analysis.points[i].date}
            </text>
          ))}
      </svg>
    </div>
  );
}
function Scatter({
  teams,
  active,
  selected,
  choose,
}: {
  teams: ExploredTeam[];
  active: string;
  selected: string[];
  choose: (id: string) => void;
}) {
  const chart = useChartScale(900);
  const plotted = teams.filter(
    (t) =>
      t.analysis.volatility.value !== null &&
      t.analysis.meanChange.value !== null,
  );
  const x = scaleLinear()
    .domain([
      0,
      Math.max(1, ...plotted.map((t) => t.analysis.volatility.value!)) * 1.15,
    ])
    .nice()
    .range([65, 840]);
  const values = plotted.map((t) => t.analysis.meanChange.value!);
  const y = scaleLinear()
    .domain([Math.min(-1, ...values) * 1.2, Math.max(1, ...values) * 1.2])
    .nice()
    .range([255, 25]);
  return (
    <>
      <div
        ref={chart.ref}
        style={chart.style}
        className={cx("svg-wrap")}
        role="region"
        tabIndex={0}
        aria-label="Scrollable risk versus improvement chart"
      >
        <svg
          viewBox="0 0 900 320"
          role="group"
          aria-label="Risk versus improvement scatterplot. Focus or select a labelled team point to inspect details."
        >
          <g
            role="img"
            aria-label="Weekly volatility in Elo points versus mean weekly Elo change. Use the team buttons, selector or View as table to inspect values."
          >
            {y.ticks(5).map((tick) => (
              <g key={tick}>
                <line
                  x1={65}
                  x2={840}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="var(--court-line)"
                />
                <text x={55} y={y(tick) + 4} textAnchor="end">
                  {tick}
                </text>
              </g>
            ))}
            <line
              x1={65}
              x2={840}
              y1={y(0)}
              y2={y(0)}
              stroke="var(--line-strong)"
              strokeDasharray="4 4"
            />
            {x.ticks(6).map((tick) => (
              <text key={tick} x={x(tick)} y={276} textAnchor="middle">
                {tick}
              </text>
            ))}
            <text x={452} y={306} textAnchor="middle">
              Weekly volatility (Elo points)
            </text>
            <text transform="translate(16 145) rotate(-90)" textAnchor="middle">
              Mean weekly change (Elo points)
            </text>
          </g>
          {plotted.map((team) => (
            <g
              key={team.id}
              role="button"
              tabIndex={0}
              aria-label={`Inspect ${team.name}: volatility ${fmt(
                team.analysis.volatility.value!,
              )}, mean weekly change ${fmt(team.analysis.meanChange.value!)}`}
              onClick={() => choose(team.id)}
              onFocus={() => choose(team.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  choose(team.id);
                }
              }}
            >
              <circle
                cx={x(team.analysis.volatility.value!)}
                cy={y(team.analysis.meanChange.value!)}
                r={16}
                opacity={0}
                fill={active === team.id ? "var(--ball-text)" : "var(--paint)"}
                stroke="var(--panel)"
                strokeWidth={2}
              />
              <SeriesMarker
                slot={Math.max(0, selected.indexOf(team.id))}
                x={x(team.analysis.volatility.value!)}
                y={y(team.analysis.meanChange.value!)}
                color={active === team.id ? "var(--ball-text)" : "var(--paint)"}
              />
              <title>{team.name}</title>
              {active === team.id ? (
                <text
                  x={x(team.analysis.volatility.value!) + 12}
                  y={y(team.analysis.meanChange.value!) - 10}
                >
                  {team.id}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
      {!plotted.length ? (
        <p className={cx("empty")}>
          At least two calendar weeks are needed to plot volatility. Expand the
          date range.
        </p>
      ) : null}
      <details className={cx("data-alternative")}>
        <summary>View as table</summary>
        <div
          className={cx("table-scroll")}
          role="region"
          aria-label="Risk versus improvement data"
          tabIndex={0}
        >
          <table>
            <caption>
              Risk versus improvement, Elo points per calendar week.
            </caption>
            <thead>
              <tr>
                <th>Team</th>
                <th>Weekly volatility (Elo points)</th>
                <th>Mean weekly change (Elo points)</th>
                <th>Sample weeks</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <th scope="row">{team.name}</th>
                  <td>
                    {metric(team.analysis.volatility)}
                    {team.analysis.volatility.value === null ? (
                      <small>{reason(team.analysis.volatility)}</small>
                    ) : null}
                  </td>
                  <td>{metric(team.analysis.meanChange)}</td>
                  <td>{team.analysis.observations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <label className={cx("detail-picker")}>
        Inspect a team{" "}
        <select value={active} onChange={(e) => choose(e.target.value)}>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
