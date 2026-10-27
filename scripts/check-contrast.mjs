import { readFileSync } from "node:fs";
const css = readFileSync(
  new URL("../src/styles/tokens.css", import.meta.url),
  "utf8",
);
const tokens = Object.fromEntries(
  [...css.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})/gi)].map((m) => [m[1], m[2]]),
);
const rgb = (hex) => hex.match(/[a-f\d]{2}/gi).map((v) => parseInt(v, 16));
const luminance = (hex) =>
  rgb(hex)
    .map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) /
  (Math.min(luminance(a), luminance(b)) + 0.05);
const pairs = [];
for (const bg of ["--cloud", "--panel", "--key"])
  for (const fg of ["--ink", "--ink-muted", "--ball-text", "--paint"])
    pairs.push([fg, bg, 4.5]);
pairs.push(["--ink", "--ball", 4.5], ["--panel", "--paint", 4.5]);
for (const bg of ["--cloud", "--panel", "--key"])
  pairs.push(["--line-strong", bg, 3]);
for (let i = 1; i <= 5; i++) pairs.push([`--series-${i}`, "--cloud", 3]);
let failed = 0;
for (const [fg, bg, min] of pairs) {
  const r = ratio(tokens[fg], tokens[bg]);
  console.log(`${fg} on ${bg}: ${r.toFixed(2)}:1 (needs ${min})`);
  if (r < min) failed++;
}
for (const token of ["--corr-neg", "--corr-pos"])
  for (let i = 0; i <= 100; i++) {
    const alpha = (i / 100) * 0.28;
    const mixed = rgb(tokens[token])
      .map((v, j) =>
        Math.round(v * alpha + rgb(tokens["--panel"])[j] * (1 - alpha)),
      )
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    if (ratio(tokens["--ink"], mixed) < 4.5) failed++;
  }
console.log(`202 heatmap samples checked; ${failed} failures.`);
if (failed) process.exitCode = 1;
