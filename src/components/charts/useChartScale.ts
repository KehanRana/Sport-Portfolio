import { useEffect, useRef, useState } from "react";
/** Compensate for viewBox scaling so token-sized text stays readable in CSS pixels. */
export function useChartScale(viewBoxWidth: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () =>
      setScale(
        viewBoxWidth / Math.max(600, element.getBoundingClientRect().width),
      );
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewBoxWidth]);
  return { ref, style: { "--chart-font-scale": scale } as React.CSSProperties };
}
