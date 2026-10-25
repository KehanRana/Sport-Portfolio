import { useMemo } from "react";
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
  const ids = weights.map((w) => w.teamId);
  const matrix = useMemo(
    () =>
      ids.map((left) =>
        ids.map((right) =>
          correlation(dataset.teams[left], dataset.teams[right])
        )
      ),
    [dataset, weights]
  );
  return (
    <section className="correlation-panel" aria-labelledby="correlation-title">
      <h3 id="correlation-title">How your teams move together</h3>
      <p>
        Correlation of weekly Elo changes for the last replayed portfolio ·{" "}
        {dataset.start} to {dataset.end}. All selected teams, including
        zero-weight entries.
      </p>
      <div className="correlation-scale">
        <span>−1 · Opposite</span>
        <span>0 · No linear relationship</span>
        <span>+1 · Together</span>
      </div>
      <div
        className="table-scroll"
        role="region"
        aria-label="Portfolio correlation heatmap"
        tabIndex={0}
      >
        <table className="heatmap">
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
                      ? "#eef0ea"
                      : result.value < 0
                      ? `rgba(166, 80, 38, ${
                          0.08 + Math.abs(result.value) * 0.22
                        })`
                      : `rgba(41, 105, 70, ${0.08 + result.value * 0.22})`;
                  return (
                    <td key={other} style={{ background: bg }}>
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
