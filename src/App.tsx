import styles from "./App.module.css";
import { bindClasses } from "./styles/classes";
const cx = bindClasses(styles);
import { useEffect, useState } from "react";
import { loadManifest, loadSeason } from "./data/load";
import Exploration from "./components/Exploration";
import { restorePortfolio, type SavedPortfolio } from "./storage/portfolio";
import type { Manifest, Season, SeasonSummary } from "./data/schema";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };
function LoadMessage({
  state,
  retry,
}: {
  state: "loading" | "error";
  retry: () => void;
}) {
  return (
    <div
      className={cx("load-message")}
      role={state === "error" ? "alert" : "status"}
      aria-busy={state === "loading"}
    >
      <span className={cx("status-dot")} />
      {state === "loading" ? (
        <div className={cx("loading-skeleton")} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      ) : null}
      {state === "loading" ? (
        "Loading historical season…"
      ) : (
        <>
          We couldn’t load this dataset. Check your connection and try again.{" "}
          <button onClick={retry}>Retry</button>
        </>
      )}
    </div>
  );
}
function SeasonBrowser({
  summary,
  manifest,
  saved,
  storageMessage,
}: {
  summary: SeasonSummary;
  manifest: Manifest;
  saved: SavedPortfolio | null;
  storageMessage: string;
}) {
  const [state, setState] = useState<LoadState<Season>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    loadSeason(summary, controller.signal)
      .then((data) => setState({ status: "ready", data }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            status: "error",
            message:
              error instanceof Error ? error.message : "Invalid season data",
          });
      });
    return () => controller.abort();
  }, [summary, attempt]);
  if (state.status !== "ready")
    return (
      <>
        <LoadMessage
          state={state.status}
          retry={() => setAttempt((value) => value + 1)}
        />
        {state.status === "error" ? (
          <p className={cx("error-detail")}>{state.message}</p>
        ) : null}
      </>
    );
  return (
    <Exploration
      season={state.data}
      summary={summary}
      manifest={manifest}
      saved={saved}
      storageMessage={storageMessage}
    />
  );
}
export default function App() {
  const [manifest, setManifest] = useState<LoadState<Manifest>>({
    status: "loading",
  });
  const [selected, setSelected] = useState("2014-15");
  const [saved, setSaved] = useState<SavedPortfolio | null>(null);
  const [storageMessage, setStorageMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setManifest({ status: "loading" });
    loadManifest(controller.signal)
      .then((data) => {
        const restored = restorePortfolio(data);
        setSaved(restored.saved);
        setStorageMessage(restored.message);
        if (restored.saved) setSelected(restored.saved.season);
        setManifest({ status: "ready", data });
        setSelected((current) =>
          data.seasons.some((s) => s.season === current)
            ? current
            : data.seasons[data.seasons.length - 1].season,
        );
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setManifest({
            status: "error",
            message:
              error instanceof Error ? error.message : "Invalid manifest",
          });
      });
    return () => controller.abort();
  }, [attempt]);
  const summary =
    manifest.status === "ready"
      ? manifest.data.seasons.find((s) => s.season === selected)
      : undefined;
  return (
    <>
      <a className={cx("skip-link")} href="#main">
        Skip to content
      </a>
      <header className={cx(`header ${filtersOpen ? "filters-open" : ""}`)}>
        <a className={cx("brand")} href="./" aria-label="Courtfolio home">
          Courtfolio<span className={cx("brand-period")}>.</span>
        </a>
        <button
          className={cx("filters-toggle")}
          aria-expanded={filtersOpen}
          aria-controls="global-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filters
        </button>
        <div id="global-filters" className={cx("global-filters")}>
          <label className={cx("season-control")} htmlFor="season">
            Season
            <select
              id="season"
              value={selected}
              disabled={manifest.status !== "ready"}
              onChange={(event) => {
                setSelected(event.target.value);
                setSaved(null);
                setStorageMessage(
                  "New season: defaults loaded. Save to replace your previous portfolio.",
                );
              }}
            >
              {manifest.status === "ready" ? (
                [...manifest.data.seasons].reverse().map((s) => (
                  <option key={s.season} value={s.season}>
                    {s.season.replace("-", "–")}
                  </option>
                ))
              ) : (
                <option value="2014-15">Loading…</option>
              )}
            </select>
          </label>
          <div id="date-controls" />
        </div>
      </header>
      <main id="main">
        <div className={cx("hero")}>
          <div>
            <h1>{selected.replace("-", "–")}</h1>
            <p>
              Compare team improvement, explore consistency and replay your own
              allocation.
            </p>
          </div>
          <div className={cx("hero-note")}>
            <span className={cx("tag")}>
              Retrospective replay, not a prediction
            </span>
            <p>
              30 NBA teams across three historical seasons
              <br />
              2012–13 to 2014–15
              <br />
              Synthetic units. Real game history.
            </p>
          </div>
        </div>
        {summary && manifest.status === "ready" ? (
          <SeasonBrowser
            key={summary.season}
            summary={summary}
            manifest={manifest.data}
            saved={saved}
            storageMessage={storageMessage}
          />
        ) : (
          <LoadMessage
            state={manifest.status === "error" ? "error" : "loading"}
            retry={() => setAttempt((value) => value + 1)}
          />
        )}
      </main>
      <footer>
        <span className={cx("footer-brand")}>
          courtfolio<span> / An independent analytics project</span>
        </span>
        <p>
          Data:{" "}
          <a href="https://github.com/fivethirtyeight/data/tree/master/nba-elo">
            FiveThirtyEight
          </a>{" "}
          ; <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>{" "}
          ; Filtered and transformed.{" "}
          <a href={`${import.meta.env.BASE_URL}data-sources.md`}>
            Transformation notes
          </a>
        </p>
      </footer>
    </>
  );
}
