// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axe from "axe-core";
import { readFileSync } from "node:fs";
import App from "./App";
let root: Root | undefined;
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(async () => {
  await act(async () => root?.unmount());
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
it("has no serious or critical accessibility structure findings in the populated dashboard", async () => {
  document.documentElement.lang = "en";
  document.title = "Courtfolio";
  document.body.innerHTML = '<div id="root"></div>';
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const filename = String(input).split("/").at(-1);
      return new Response(
        readFileSync(`${process.cwd()}/public/data/${filename}`, "utf8"),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }),
  );
  root = createRoot(document.getElementById("root")!);
  await act(async () => {
    root!.render(<App />);
  });
  expect(document.body.textContent).toContain("Portfolio replay");
  const results = await axe.run(document.body, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(
    results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
});
