import { formatInches } from "@/lib/format";
import type { Overall } from "@/lib/types";

export function DimensionBoard({ overall }: { overall: Overall }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      <View label="Front" x={overall.w} y={overall.h} xName="W" yName="H" />
      <View label="Side" x={overall.d} y={overall.h} xName="D" yName="H" />
      <View label="Top" x={overall.w} y={overall.d} xName="W" yName="D" />
    </div>
  );
}

function View({
  label,
  x,
  y,
  xName,
  yName,
}: {
  label: string;
  x: number;
  y: number;
  xName: string;
  yName: string;
}) {
  const max = Math.max(x, y, 1);
  const w = (x / max) * 70;
  const h = (y / max) * 70;
  const ox = (100 - w) / 2;
  const oy = (88 - h) / 2 + 4;
  return (
    <figure className="rounded-md bg-paper px-2 py-2 text-ink">
      <svg viewBox="0 0 100 100" className="h-auto w-full" aria-hidden>
        <rect
          x={ox}
          y={oy}
          width={w}
          height={h}
          fill="#d9d0bc"
          stroke="#1a1714"
          strokeWidth="1.2"
        />
        <path
          d={`M ${ox} ${oy + h + 6} L ${ox + w} ${oy + h + 6}`}
          stroke="#1a1714"
          strokeWidth="0.7"
        />
        <path
          d={`M ${ox - 6} ${oy} L ${ox - 6} ${oy + h}`}
          stroke="#1a1714"
          strokeWidth="0.7"
        />
        <text
          x={ox + w / 2}
          y={oy + h + 11}
          textAnchor="middle"
          fontSize="6.5"
          fill="#1a1714"
          fontFamily="IBM Plex Mono, monospace"
        >
          {xName} {formatInches(x)}
        </text>
        <text
          x={ox - 8}
          y={oy + h / 2}
          textAnchor="middle"
          fontSize="6.5"
          fill="#1a1714"
          fontFamily="IBM Plex Mono, monospace"
          transform={`rotate(-90 ${ox - 8} ${oy + h / 2})`}
        >
          {yName} {formatInches(y)}
        </text>
      </svg>
      <figcaption className="mt-1 text-center font-mono text-xs text-ink-soft">
        {label}
      </figcaption>
    </figure>
  );
}
