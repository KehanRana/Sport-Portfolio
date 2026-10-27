import styles from "./Correlation.module.css";
import { bindClasses } from "../styles/classes";
const cx = bindClasses(styles);
import { useId, useMemo } from "react";
import {
  correlation,
  type WeeklyDataset,
  type Weight,
} from "../analytics/engine";
export default function Correlation({
  dataset,
  weights,
}: {
  dataset: WeeklyDataset;
  weights: Weight[];
}) {
  const hatchPrefix = useId().replace(/:/g, "");
  const ids = weights.map((w) => w.teamId);
  const matrix = useMemo(
    () =>
      ids.map((left) =>
        ids.map((right) =>
          correlation(dataset.teams[left], dataset.teams[right]),
        ),
      ),
    [dataset, weights],
  );
  return (
    <section
      className={cx("correlation-panel")}
      aria-labelledby="correlation-title"
    >
      <h3 id="correlation-title">Correlation between teams</h3>
      <p>
        Correlation of weekly Elo changes for the last replayed portfolio ;{" "}
        {dataset.start} to {dataset.end}. All selected teams, including
        zero-weight entries.
      </p>
      <div className={cx("correlation-scale")}>
        <span>−1; Opposite</span>
        <span>0; No linear relationship</span>
        <span>+1; Together</span>
      </div>
      <div
        className={cx("table-scroll")}
        role="region"
        aria-label="Portfolio correlation heatmap"
        tabIndex={0}
      >
        <table className={cx("heatmap")}>
          <caption>
            Paired calendar weeks, including inactivity. Each cell shows Pearson
            correlation and sample count.
          </caption>
          <thead>
            <tr>
              <th scope="col">Team</th>
              {ids.map((id) => (
                <th key={id} scope="col">
                  {id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ids.map((id, i) => (
              <tr key={id}>
                <th scope="row">{id}</th>
                {ids.map((other, j) => {
                  const result = matrix[i][j];
                  const unavailable =
                    result.reason === "zero-variance"
                      ? "Zero variance"
                      : "Needs at least 10 weeks";
                  const bg =
                    result.value === null
                      ? "var(--key)"
                      : `color-mix(in srgb, var(${result.value < 0 ? "--corr-neg" : "--corr-pos"}) ${Math.abs(result.value) * 28}%, var(--corr-zero))`;
                  return (
                    <td
                      key={other}
                      className={cx(
                        result.value === null ? "unavailable-cell" : "",
                      )}
                      aria-label={`${id} and ${other}: ${result.value === null ? unavailable : result.value.toFixed(2)}, ${result.observations} paired weeks`}
                      style={{ background: bg }}
                    >
                      {result.value === null ? (
                        <svg
                          className={cx("cell-hatch")}
                          aria-hidden="true"
                          width="100%"
                          height="100%"
                        >
                          <defs>
                            <pattern
                              id={`${hatchPrefix}-${i}-${j}`}
                              width="9"
                              height="9"
                              patternUnits="userSpaceOnUse"
                              patternTransform="rotate(135)"
                            >
                              <rect width="9" height="9" fill="var(--panel)" />
                              <rect width="2.5" height="9" fill="var(--line)" />
                            </pattern>
                          </defs>
                          <rect
                            width="100%"
                            height="100%"
                            fill={`url(#${hatchPrefix}-${i}-${j})`}
                          />
                        </svg>
                      ) : null}
                      <strong>
                        {result.value === null
                          ? "N/A"
                          : result.value.toFixed(2)}
                      </strong>
                      <small>{result.observations} weeks</small>
                      {result.value === null ? (
                        <small>{unavailable}</small>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Correlation needs at least 10 paired weeks and nonzero variance in both
        teams. Idle weeks, partial weeks and direct matchups affect the result.
        Correlation describes this historical interval and does not predict
        future diversification.
      </p>
    </section>
  );
}
