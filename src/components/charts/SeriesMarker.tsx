export default function SeriesMarker({
  slot,
  x,
  y,
  color,
}: {
  slot: number;
  x: number;
  y: number;
  color: string;
}) {
  const paths = [
    "M-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0",
    "M-5-5H5V5H-5Z",
    "M0-6L6 5H-6Z",
    "M0-7L6 0L0 7L-6 0Z",
    "M-5-5L5 5M5-5L-5 5",
  ];
  return (
    <path
      d={paths[slot % 5]}
      transform={`translate(${x} ${y})`}
      fill={slot % 5 === 4 ? "none" : color}
      stroke={color}
      strokeWidth={2}
      aria-hidden="true"
    />
  );
}
