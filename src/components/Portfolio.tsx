import { useChartScale } from "./charts/useChartScale";
import styles from "./Portfolio.module.css";
import { bindClasses } from "../styles/classes";
const cx = bindClasses(styles);
import { useId, useMemo, useState } from "react";
import Correlation from "./Correlation";
import { scaleLinear } from "d3-scale";
import { area, line } from "d3-shape";
import type { ExploredTeam } from "../analytics/exploration";
import type {
  Analysis,
  Metric,
  Weight,
  WeeklyDataset,
} from "../analytics/engine";
import {
  equalWeights,
  replayPortfolio,
  validatePortfolio,
  type DraftWeight,
} from "../analytics/portfolio";
const defaults: Weight[] = [
  { teamId: "GSW", percent: 50 },
  { teamId: "CLE", percent: 50 },
];
const signed = (value: number) =>
  (value > 0 ? "↑ +" : value < 0 ? "↓ " : "") + value.toFixed(2);
const number = (value: number) => value.toFixed(2);
const metric = (value: Metric) =>
  value.value === null
    ? `N/A (${
        value.reason === "zero-variance"
          ? "zero variance"
          : "insufficient weeks"
      })`
    : number(value.value);
export default function Portfolio({
  dataset,
  teams,
  initialWeights,
  onSave,
  onClear,
  saveMessage,
}: {
  dataset: WeeklyDataset;
  teams: ExploredTeam[];
  initialWeights?: Weight[];
  onSave: (weights: Weight[]) => void;
  onClear: () => void;
  saveMessage: string;
}) {
  const [draft, setDraft] = useState<DraftWeight[]>(() =>
    (initialWeights ?? defaults).map((w) => ({
      teamId: w.teamId,
      value: String(w.percent),
    })),
  );
  const [applied, setApplied] = useState(initialWeights ?? defaults);
  const [candidate, setCandidate] = useState("");
  const [notice, setNotice] = useState(
    initialWeights
      ? "Restored your applied allocation."
      : "Example portfolio: 50% Golden State and 50% Cleveland.",
  );
  const [replayCount, setReplayCount] = useState(0);
  const [cursor, setCursor] = useState(0);
  const validation = validatePortfolio(
    draft,
    teams.map((t) => t.id),
  );
  const replay = useMemo(
    () => replayPortfolio(dataset, applied),
    [dataset, applied],
  );
  const available = teams.filter((t) => !draft.some((w) => w.teamId === t.id));
  const choice = available.some((t) => t.id === candidate)
    ? candidate
    : (available[0]?.id ?? "");
  const total = draft.reduce(
    (sum, w) => sum + (Number.isFinite(Number(w.value)) ? Number(w.value) : 0),
    0,
  );
  const dirty =
    JSON.stringify(
      draft.map((w) => ({ teamId: w.teamId, percent: Number(w.value) })),
    ) !== JSON.stringify(applied) || draft.some((w) => w.value === "");
  const position = Math.min(cursor, replay.weekly.length - 1);
  const selectedWeek = replay.weekly[position];
  const reset = () => {
    setDraft(
      defaults.map((w) => ({ teamId: w.teamId, value: String(w.percent) })),
    );
    setApplied(defaults);
    setCursor(0);
    setNotice("Reset to the example portfolio.");
  };
  return (
    <>
      <section
        className={cx("portfolio-edit-panel chamfer")}
        aria-labelledby="portfolio-title"
      >
        <div className={cx("panel-heading")}>
          <div>
            <h2 id="portfolio-title">Build a portfolio</h2>
            <p>
              Fixed exposures; synthetic index points; retrospective historical
              replay
            </p>
          </div>
        </div>
        <form
          className={cx("portfolio-builder")}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (validation.weights) {
              setApplied(validation.weights);
              setReplayCount((count) => count + 1);
              setCursor(0);
              setNotice("Portfolio replay updated.");
            }
          }}
        >
          <div className={cx("portfolio-add")}>
            <label htmlFor="portfolio-team">
              Choose a portfolio team
              <select
                id="portfolio-team"
                value={choice}
                disabled={draft.length >= 10}
                onChange={(e) => setCandidate(e.target.value)}
              >
                {available.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={draft.length >= 10 || !choice}
              onClick={() => {
                setDraft([...draft, { teamId: choice, value: "0" }]);
                setNotice(
                  "Team added with zero weight. Set allocations, then replay.",
                );
              }}
            >
              Add team
            </button>
          </div>
          <p className={cx("portfolio-hint")}>
            {draft.length}/10 teams; Separate from your comparison selections.
            Changing season resets this portfolio.
          </p>
          <div className={cx("weight-list")}>
            {draft.map((entry) => (
              <div className={cx("weight-row")} key={entry.teamId}>
                <label htmlFor={`weight-${entry.teamId}`}>
                  {teams.find((t) => t.id === entry.teamId)?.name}
                  <small>{entry.teamId}</small>
                </label>
                <div className={cx("weight-input")}>
                  <input
                    id={`weight-${entry.teamId}`}
                    aria-label={`Weight for ${
                      teams.find((t) => t.id === entry.teamId)?.name
                    } (%)`}
                    type="number"
                    aria-invalid={!!validation.error}
                    aria-describedby={
                      validation.error ? "allocation-error" : undefined
                    }
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    value={entry.value}
                    onInput={(e) => {
                      const value = e.currentTarget.value;
                      setDraft((current) =>
                        current.map((w) =>
                          w.teamId === entry.teamId ? { ...w, value } : w,
                        ),
                      );
                    }}
                  />
                  <span>%</span>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${
                    teams.find((t) => t.id === entry.teamId)?.name
                  } from portfolio`}
                  onClick={() =>
                    setDraft((current) =>
                      current.filter((w) => w.teamId !== entry.teamId),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className={cx("weight-total")}>
            <strong>Total allocation: {number(total)}%</strong>
            <span>{validation.error ?? "Valid allocation"}</span>
          </div>
          {validation.error ? (
            <p
              id="allocation-error"
              className={cx("allocation-error")}
              role="status"
            >
              {validation.error} Replay is disabled; previous results remain
              below.
            </p>
          ) : null}
          <div className={cx("portfolio-actions")}>
            <button
              type="submit"
              className={cx("primary")}
              disabled={!!validation.error}
            >
              Replay portfolio{" "}
              <span className={cx("action-chevron")} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path
                    d="m6 3 5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </span>
            </button>
            <button
              type="button"
              disabled={!draft.length}
              onClick={() => {
                setDraft(equalWeights(draft.map((w) => w.teamId)));
                setNotice("Equal weights set. Replay portfolio to apply.");
              }}
            >
              Set equal weights
            </button>
            <button type="button" onClick={reset}>
              Reset portfolio
            </button>
          </div>
          <p className={cx("portfolio-hint")}>
            Totals within 0.01 percentage points of 100% are accepted and
            normalised to exactly 100% for calculation. Equal weighting
            distributes rounding across teams.
          </p>
          <p role="status" className={cx("portfolio-notice")}>
            {notice}
            {dirty
              ? " Unapplied edits: charts still use the last replayed allocation."
              : ""}
          </p>
        </form>
        <div className={cx("save-controls")}>
          <button onClick={() => onSave(applied)}>Save portfolio</button>
          <button onClick={onClear}>Clear saved portfolio</button>
          <p role="status">{saveMessage}</p>
          <p>
            Stored only on this browser: season, applied dates, comparison teams
            and replayed weights. Save explicitly after changing your analysis.
          </p>
        </div>
      </section>
      <section className={cx("portfolio-replay")} aria-label="Portfolio replay">
        <div className={cx("result-block")}>
          <div className={cx("replay-heading")}>
            <h2>Portfolio replay</h2>
            <span className={cx("tag")}>
              Retrospective replay, not a prediction
            </span>
            <p>
              {dataset.start} to {dataset.end}; {dataset.weeks.length} weeks ;
              Dates follow the evaluation window above.
            </p>
            <p>
              Applied weights:{" "}
              {replay.weights
                .map((w) => `${w.teamId} ${number(w.weight * 100)}%`)
                .join("; ")}
            </p>
          </div>
          <div
            key={replayCount}
            className={cx(
              `portfolio-metrics ${replayCount ? "numbers-settle" : ""}`,
            )}
            role="region"
            aria-label="Portfolio replay statistics"
          >
            <article>
              <span>Final index</span>
              <strong>{number(replay.portfolio.points.at(-1)!.index)}</strong>
              <small>
                Starts at 100; {signed(replay.portfolio.totalChange)} point
                change; n = {dataset.weeks.length} weeks
              </small>
            </article>
            <article>
              <span>Weekly volatility (Elo points)</span>
              <strong>{metric(replay.portfolio.volatility)}</strong>
              <small>n = {dataset.weeks.length} weeks</small>
            </article>
            <article>
              <span>Consistency (mean ÷ sample SD)</span>
              <strong>{metric(replay.portfolio.consistency)}</strong>
              <small>Unannualised; n = {dataset.weeks.length} weeks</small>
            </article>
            <article>
              <span>Maximum drawdown</span>
              <strong>
                {number(replay.portfolio.maxDrawdown.magnitude)} pts
              </strong>
              <small>
                Peak {replay.portfolio.maxDrawdown.peakDate}
                <br />
                Trough {replay.portfolio.maxDrawdown.troughDate}; n ={" "}
                {dataset.weeks.length} weeks
              </small>
            </article>
          </div>
        </div>
        <section className={cx("replay-charts")}>
          <div className={cx("portfolio-chart-heading")}>
            <h3>Performance versus the neutral reference</h3>
            <p>Index points; the dashed line is the all-team reference.</p>
          </div>
          <ReplayChart
            portfolio={replay.portfolio}
            benchmark={replay.benchmark}
            position={position}
            animation={replayCount}
            drawdown={false}
          />
          <div className={cx("portfolio-chart-heading")}>
            <h3>Drawdown from the running peak</h3>
            <p>
              Index points below the weekly high-water mark, including the
              initial 100 baseline. Peak {replay.portfolio.maxDrawdown.peakDate}
              ; trough {replay.portfolio.maxDrawdown.troughDate}.
            </p>
          </div>
          <ReplayChart
            portfolio={replay.portfolio}
            benchmark={replay.benchmark}
            position={position}
            animation={0}
            drawdown
          />
          <label className={cx("week-control")}>
            Inspect portfolio week starting {selectedWeek.week}
            <input
              aria-label="Portfolio inspection week"
              type="range"
              min="0"
              max={replay.weekly.length - 1}
              value={position}
              onChange={(e) => setCursor(Number(e.target.value))}
            />
          </label>
          <p className={cx("weekly-details")} aria-live="polite">
            Week of {selectedWeek.week}: index{" "}
            {number(replay.portfolio.points[position + 1].index)}; change{" "}
            {signed(selectedWeek.change)} Elo points; drawdown{" "}
            {number(replay.portfolio.points[position + 1].drawdown)} points ;{" "}
            {selectedWeek.games} team-game exposures
          </p>
          <details className={cx("data-alternative")}>
            <summary>View as table</summary>
            <div
              className={cx("table-scroll")}
              role="region"
              aria-label="Portfolio replay data"
              tabIndex={0}
            >
              <table>
                <caption>
                  Opening baseline 100; each row is the end of an included
                  calendar-week bucket.
                </caption>
                <thead>
                  <tr>
                    <th>Week starting</th>
                    <th>Portfolio index</th>
                    <th>Elo change</th>
                    <th>Reference index</th>
                    <th>Drawdown points</th>
                    <th>Team-game exposures</th>
                  </tr>
                </thead>
                <tbody>
                  {replay.weekly.map((w, i) => (
                    <tr
                      key={w.week}
                      className={cx(i === position ? "cursor-row" : "")}
                    >
                      <th scope="row">
                        {w.week}
                        {w.week < dataset.start ||
                        new Date(
                          Date.parse(w.week + "T00:00:00Z") + 6 * 86400000,
                        )
                          .toISOString()
                          .slice(0, 10) > dataset.end
                          ? " (partial week)"
                          : ""}
                      </th>
                      <td>{number(replay.portfolio.points[i + 1].index)}</td>
                      <td data-trend={w.change < 0 ? "loss" : "gain"}>
                        {signed(w.change)}
                      </td>
                      <td>{number(replay.benchmark.points[i + 1].index)}</td>
                      <td>{number(replay.portfolio.points[i + 1].drawdown)}</td>
                      <td>{w.games}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <div className={cx("portfolio-footnote")}>
            <p>
              This is a retrospective simulation of rating changes, not betting
              profit or investment returns. Weights stay fixed; performance is
              additive. The all-team reference is theoretically flat because Elo
              changes cancel, with tiny residuals from source rounding.
            </p>
            <p>
              Idle weeks count as zero change. Partial boundary weeks remain
              observations. Weekly drawdowns can miss larger declines within a
              week. Team-game exposures count each positive-weight selected
              team's games; a matchup between two selected teams counts twice.{" "}
              {replay.portfolio.maxDrawdown.magnitude === 0
                ? "No decline: peak and trough dates use the interval start."
                : ""}
            </p>
          </div>
        </section>
      </section>
      <Correlation dataset={dataset} weights={applied} />
    </>
  );
}
function ReplayChart({
  portfolio,
  benchmark,
  position,
  drawdown,
  animation,
}: {
  portfolio: Analysis;
  benchmark: Analysis;
  position: number;
  drawdown: boolean;
  animation: number;
}) {
  const chart = useChartScale(900);
  const hatchId = useId().replace(/:/g, "");
  const w = 900,
    h = 260,
    left = 65,
    right = 130,
    top = 20,
    bottom = 45;
  const value = (p: Analysis["points"][number]) =>
    drawdown ? p.drawdown : p.index;
  const values = (
    drawdown ? portfolio.points : [...portfolio.points, ...benchmark.points]
  ).map(value);
  const lo = Math.min(...values),
    hi = Math.max(...values),
    padding = Math.max(1, (hi - lo) * 0.1);
  const x = scaleLinear()
    .domain([0, portfolio.points.length - 1])
    .range([left, w - right]);
  const y = scaleLinear()
    .domain([lo - padding, hi + padding])
    .nice()
    .range([h - bottom, top]);
  const path = line<Analysis["points"][number]>()
    .x((_, i) => x(i))
    .y((p) => y(value(p)));
  const name = drawdown
    ? "Portfolio drawdown chart"
    : "Portfolio performance chart";
  return (
    <div
      ref={chart.ref}
      style={chart.style}
      className={cx("svg-wrap")}
      role="region"
      tabIndex={0}
      aria-label={`Scrollable ${name.toLowerCase()}`}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${name}. Use the shared inspection slider or portfolio replay data table for exact values.`}
      >
        <defs>
          <pattern
            id={hatchId}
            width="9"
            height="9"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(135)"
          >
            <rect width="9" height="9" fill="var(--ball)" fillOpacity="0.25" />
            <rect width="2.5" height="9" fill="var(--ball)" />
          </pattern>
        </defs>
        {drawdown ? (
          <path
            d={
              area<Analysis["points"][number]>()
                .x((_, i) => x(i))
                .y0(y(0))
                .y1((p) => y(p.drawdown))(portfolio.points) ?? ""
            }
            fill={`url(#${hatchId})`}
          />
        ) : (
          <>
            <rect
              x={left}
              y={top}
              width={w - right - left}
              height={h - bottom - top}
              fill="none"
              stroke="var(--line)"
            />
            <line
              x1={left}
              x2={w - right}
              y1={y(100)}
              y2={y(100)}
              stroke="var(--line)"
            />
            <circle
              cx={left}
              cy={y(100)}
              r={13}
              fill="var(--chalk)"
              stroke="var(--paint)"
              strokeWidth={1.5}
            />
          </>
        )}
        {y.ticks(5).map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={w - right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--line)"
            />
            <text x={left - 10} y={y(tick) + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        {!drawdown ? (
          <path
            d={path(benchmark.points) ?? ""}
            fill="none"
            stroke="var(--orange-text)"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        ) : null}
        <path
          key={animation}
          className={cx(animation ? "replay-line" : undefined)}
          pathLength={1}
          d={path(portfolio.points) ?? ""}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.5"
        />
        <line
          x1={x(position + 1)}
          x2={x(position + 1)}
          y1={top}
          y2={h - bottom}
          stroke="var(--ink)"
          strokeDasharray="2 4"
        />
        <circle
          cx={x(position + 1)}
          cy={y(value(portfolio.points[position + 1]))}
          r="4"
          fill="var(--ink)"
        />
        {!drawdown ? (
          <text x={left + 20} y={y(100) - 10}>
            Start (100)
          </text>
        ) : null}
        <text x={w - right + 14} y={y(value(portfolio.points.at(-1)!)) + 4}>
          Portfolio
        </text>
        {!drawdown ? (
          <text
            x={w - right + 14}
            y={
              y(benchmark.points.at(-1)!.index) +
              (Math.abs(y(portfolio.points.at(-1)!.index) - y(100)) < 20
                ? 24
                : 4)
            }
            fill="var(--orange-text)"
          >
            Reference
          </text>
        ) : null}
        {drawdown ? (
          <g>
            <circle
              cx={x(
                Math.max(
                  0,
                  portfolio.points.findIndex(
                    (p) =>
                      p.date === portfolio.maxDrawdown.troughDate &&
                      p.drawdown === -portfolio.maxDrawdown.magnitude,
                  ),
                ),
              )}
              cy={y(-portfolio.maxDrawdown.magnitude)}
              r="6"
              fill="var(--ink)"
            />
            <text x={left + 12} y={top + 14}>
              Maximum decline {number(portfolio.maxDrawdown.magnitude)} points
            </text>
          </g>
        ) : null}
        {[
          0,
          Math.floor((portfolio.points.length - 1) / 2),
          portfolio.points.length - 1,
        ]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((i) => (
            <text key={i} x={x(i)} y={h - 15} textAnchor="middle">
              {portfolio.points[i].date}
            </text>
          ))}
      </svg>
    </div>
  );
}
