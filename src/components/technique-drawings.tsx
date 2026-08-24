import type { ReactNode } from "react";
import {
  FIGURE_PRIORITY,
  figuresForStep,
  hasTechniqueFigure,
  techniqueCaption,
  techniqueCast,
  techniqueLettersKey,
  techniquePlainName,
  type TechniqueFigureId,
} from "@/lib/technique-drawings";
import type { CutRow } from "@/lib/types";

const INK = "var(--color-ink)";
const PAPER = "var(--color-paper)";
const WOOD = "var(--color-paper-2)";
const WOOD_DK = "#cfc3ab";
const FONT = "IBM Plex Mono, monospace";

type CutRef = Pick<CutRow, "id" | "letter" | "name" | "role">;

function Mark({ x, y, children }: { x: number; y: number; children?: string }) {
  if (!children) return null;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize="5.5"
      fill={INK}
      fontFamily={FONT}
    >
      {children}
    </text>
  );
}

function Frame({
  children,
  compact,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 72"
      className={compact ? "h-auto w-full max-w-[16rem]" : "h-auto w-full"}
      aria-hidden
    >
      {children}
    </svg>
  );
}

function PocketFigure({ host, guest }: { host?: string; guest?: string }) {
  return (
    <>
      <rect x="18" y="8" width="14" height="52" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
      <rect x="32" y="28" width="48" height="12" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <ellipse cx="38" cy="31.5" rx="4" ry="2.2" fill="none" stroke={INK} strokeWidth="0.8" />
      <ellipse cx="38" cy="36.5" rx="4" ry="2.2" fill="none" stroke={INK} strokeWidth="0.8" />
      <path d="M42 31.5 L30 31.5" stroke={INK} strokeWidth="0.8" markerEnd="none" />
      <path d="M42 36.5 L30 36.5" stroke={INK} strokeWidth="0.8" />
      <path d="M72 34 L84 34" stroke={INK} strokeWidth="0.9" />
      <path d="M80 30 L84 34 L80 38" fill="none" stroke={INK} strokeWidth="0.9" />
      <Mark x="25" y="66">
        {host}
      </Mark>
      <Mark x="56" y="66">
        {guest}
      </Mark>
    </>
  );
}

function MortiseFigure({ host, guest }: { host?: string; guest?: string }) {
  return (
    <>
      <rect x="16" y="8" width="16" height="52" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
      <rect x="20" y="28" width="8" height="14" fill={PAPER} stroke={INK} strokeWidth="0.8" />
      <rect x="48" y="30" width="36" height="10" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <rect x="40" y="31.5" width="8" height="7" fill={WOOD} stroke={INK} strokeWidth="0.8" />
      <path d="M40 35 L30 35" stroke={INK} strokeWidth="0.9" />
      <path d="M34 31 L30 35 L34 39" fill="none" stroke={INK} strokeWidth="0.9" />
      <Mark x="24" y="66">
        {host}
      </Mark>
      <Mark x="66" y="66">
        {guest}
      </Mark>
    </>
  );
}

function DadoFigure({ host, guest }: { host?: string; guest?: string }) {
  return (
    <>
      <rect x="18" y="8" width="14" height="54" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
      <rect x="18" y="30" width="14" height="8" fill={PAPER} stroke={INK} strokeWidth="0.8" />
      <rect x="44" y="30" width="40" height="8" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <path d="M44 34 L34 34" stroke={INK} strokeWidth="0.9" />
      <path d="M38 30 L34 34 L38 38" fill="none" stroke={INK} strokeWidth="0.9" />
      <Mark x="25" y="68">
        {host}
      </Mark>
      <Mark x="64" y="68">
        {guest}
      </Mark>
    </>
  );
}

function HalfLapFigure({
  host,
  guest,
  extra,
}: {
  host?: string;
  guest?: string;
  extra?: string;
}) {
  return (
    <>
      <rect x="18" y="10" width="10" height="46" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <rect x="72" y="10" width="10" height="46" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <rect x="18" y="10" width="64" height="9" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
      <rect x="18" y="47" width="64" height="9" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
      <g fill="none" stroke={INK} strokeWidth="1.1">
        <path d="M28 19 L72 47" />
        <path d="M72 19 L28 47" />
      </g>
      <Mark x="23" y="68">
        {host}
      </Mark>
      <Mark x="50" y="68">
        {guest}
      </Mark>
      <Mark x="77" y="68">
        {extra}
      </Mark>
    </>
  );
}

function SquareCutFigure({ host }: { host?: string }) {
  return (
    <>
      <rect x="18" y="28" width="64" height="14" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <path d="M62 22 L62 50" stroke={INK} strokeWidth="0.9" strokeDasharray="1.6 1.4" />
      <path d="M18 28 L18 18 L32 18" fill="none" stroke={INK} strokeWidth="0.9" />
      <path d="M68 24 L76 32 M76 24 L68 32" stroke={INK} strokeWidth="0.9" />
      <Mark x="50" y="62">
        {host}
      </Mark>
    </>
  );
}

function GlueUpFigure({ host }: { host?: string }) {
  return (
    <>
      <rect x="14" y="22" width="36" height="22" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <rect x="50" y="22" width="36" height="22" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
      <path d="M50 22 L50 44" stroke={INK} strokeWidth="1.1" />
      <path d="M22 16 L22 22 M78 16 L78 22 M22 44 L22 50 M78 44 L78 50" stroke={INK} strokeWidth="1.1" />
      <Mark x="50" y="64">
        {host}
      </Mark>
    </>
  );
}

function ClampUpFigure({ host, guest }: { host?: string; guest?: string }) {
  return (
    <>
      <rect x="24" y="14" width="52" height="40" fill="none" stroke={INK} strokeWidth="0.9" />
      <rect x="24" y="14" width="10" height="40" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
      <rect x="66" y="14" width="10" height="40" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
      <rect x="24" y="28" width="52" height="10" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <path d="M30 18 L70 50 M70 18 L30 50" stroke={INK} strokeWidth="0.6" strokeDasharray="2 2" />
      <Mark x="29" y="64">
        {host}
      </Mark>
      <Mark x="50" y="64">
        {guest}
      </Mark>
    </>
  );
}

function DovetailFigure({ host, guest }: { host?: string; guest?: string }) {
  return (
    <>
      <path d="M18 18 L48 18 L48 52 L18 52 Z" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
      <path d="M48 22 L58 18 L58 28 L48 32 Z" fill={WOOD} stroke={INK} strokeWidth="0.8" />
      <path d="M48 38 L58 34 L58 44 L48 48 Z" fill={WOOD} stroke={INK} strokeWidth="0.8" />
      <rect x="58" y="18" width="24" height="34" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <Mark x="33" y="64">
        {host}
      </Mark>
      <Mark x="70" y="64">
        {guest}
      </Mark>
    </>
  );
}

function TaperFigure({ host }: { host?: string }) {
  return (
    <>
      <path d="M40 10 L56 10 L56 28 L50 62 L40 62 Z" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <path d="M40 10 L40 62" stroke={INK} strokeWidth="0.7" strokeDasharray="2 1.6" />
      <path d="M38 28 L58 28" stroke={INK} strokeWidth="0.6" strokeDasharray="1.4 1.4" />
      <Mark x="48" y="68">
        {host}
      </Mark>
    </>
  );
}

function DrawerSlideFigure({ host, guest }: { host?: string; guest?: string }) {
  return (
    <>
      <rect x="16" y="12" width="12" height="48" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
      <rect x="34" y="20" width="50" height="28" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <path d="M28 26 L34 26 M28 40 L34 40" stroke={INK} strokeWidth="1.1" />
      <Mark x="22" y="68">
        {host}
      </Mark>
      <Mark x="59" y="68">
        {guest}
      </Mark>
    </>
  );
}

function FinishOilFigure({ host }: { host?: string }) {
  return (
    <>
      <rect x="18" y="24" width="52" height="22" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <ellipse cx="78" cy="30" rx="8" ry="12" fill={WOOD_DK} stroke={INK} strokeWidth="0.8" />
      <path d="M70 36 Q74 44 80 46" fill="none" stroke={INK} strokeWidth="0.8" />
      <Mark x="44" y="62">
        {host}
      </Mark>
    </>
  );
}

function ResawFigure({ host }: { host?: string }) {
  return (
    <>
      <rect x="14" y="28" width="32" height="16" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <rect x="58" y="12" width="10" height="44" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
      <path d="M63 12 L63 56" stroke={INK} strokeWidth="0.8" strokeDasharray="1.4 1.4" />
      <path d="M46 36 L56 36" stroke={INK} strokeWidth="0.9" />
      <path d="M52 32 L56 36 L52 40" fill="none" stroke={INK} strokeWidth="0.9" />
      <Mark x="30" y="60">
        {host}
      </Mark>
    </>
  );
}

function HipCleatFigure({ host, extra }: { host?: string; extra?: string }) {
  return (
    <>
      <path d="M18 18 L42 36 L42 62 L18 48 Z" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <path d="M82 18 L58 36 L58 62 L82 48 Z" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <rect x="42" y="32" width="16" height="26" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
      <Mark x="30" y="68">
        {host}
      </Mark>
      <Mark x="50" y="68">
        {extra}
      </Mark>
    </>
  );
}

function FinishPaintFigure({ host }: { host?: string }) {
  return (
    <>
      <rect x="20" y="16" width="44" height="36" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <rect x="68" y="20" width="12" height="20" fill={WOOD_DK} stroke={INK} strokeWidth="0.8" />
      <path d="M74 40 L74 52 L70 56" fill="none" stroke={INK} strokeWidth="0.9" />
      <Mark x="42" y="64">
        {host}
      </Mark>
    </>
  );
}

function OutdoorFinishFigure({ host }: { host?: string }) {
  return (
    <>
      <rect x="18" y="18" width="64" height="8" fill={WOOD} stroke={INK} strokeWidth="0.8" />
      <rect x="18" y="30" width="64" height="8" fill={WOOD} stroke={INK} strokeWidth="0.8" />
      <rect x="18" y="42" width="64" height="8" fill={WOOD} stroke={INK} strokeWidth="0.8" />
      <rect x="22" y="52" width="8" height="6" fill={WOOD_DK} stroke={INK} strokeWidth="0.7" />
      <rect x="70" y="52" width="8" height="6" fill={WOOD_DK} stroke={INK} strokeWidth="0.7" />
      <Mark x="50" y="66">
        {host}
      </Mark>
    </>
  );
}

function WoodMovementFigure({ host, guest }: { host?: string; guest?: string }) {
  return (
    <>
      <rect x="16" y="18" width="68" height="16" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <rect x="22" y="34" width="56" height="10" fill={WOOD_DK} stroke={INK} strokeWidth="0.9" />
      <circle cx="30" cy="28" r="2" fill="none" stroke={INK} strokeWidth="0.8" />
      <rect x="66" y="26" width="8" height="4" fill="none" stroke={INK} strokeWidth="0.8" />
      <Mark x="50" y="56">
        {host}
      </Mark>
      <Mark x="50" y="66">
        {guest}
      </Mark>
    </>
  );
}

function EdgeBandFigure({ host }: { host?: string }) {
  return (
    <>
      <rect x="22" y="18" width="52" height="32" fill={WOOD} stroke={INK} strokeWidth="0.9" />
      <rect x="22" y="18" width="4" height="32" fill={WOOD_DK} stroke={INK} strokeWidth="0.8" />
      <path d="M18 16 L26 16 L26 54 L18 54" fill="none" stroke={INK} strokeWidth="0.7" strokeDasharray="1.5 1.2" />
      <Mark x="48" y="64">
        {host}
      </Mark>
    </>
  );
}

function TechniqueSvg({
  id,
  host,
  guest,
  extra,
  compact,
}: {
  id: TechniqueFigureId;
  host?: string;
  guest?: string;
  extra?: string;
  compact?: boolean;
}) {
  const inner = (() => {
    switch (id) {
      case "pocket-hole":
        return <PocketFigure host={host} guest={guest} />;
      case "mortise-tenon":
        return <MortiseFigure host={host} guest={guest} />;
      case "dado":
        return <DadoFigure host={host} guest={guest} />;
      case "half-lap":
        return <HalfLapFigure host={host} guest={guest} extra={extra} />;
      case "square-cut":
        return <SquareCutFigure host={host} />;
      case "glue-up":
        return <GlueUpFigure host={host} />;
      case "clamp-up":
        return <ClampUpFigure host={host} guest={guest} />;
      case "dovetail":
        return <DovetailFigure host={host} guest={guest} />;
      case "taper-leg":
        return <TaperFigure host={host} />;
      case "drawer-slides":
        return <DrawerSlideFigure host={host} guest={guest} />;
      case "finish-oil":
        return <FinishOilFigure host={host} />;
      case "resaw":
        return <ResawFigure host={host} />;
      case "hip-cleat":
        return <HipCleatFigure host={host} extra={extra} />;
      case "finish-paint":
        return <FinishPaintFigure host={host} />;
      case "outdoor-finish":
        return <OutdoorFinishFigure host={host} />;
      case "wood-movement":
        return <WoodMovementFigure host={host} guest={guest} />;
      case "edge-banding":
        return <EdgeBandFigure host={host} />;
      default:
        return null;
    }
  })();
  return <Frame compact={compact}>{inner}</Frame>;
}

export function TechniqueFigure({
  id,
  cuts,
  compact,
}: {
  id: string;
  cuts: readonly CutRef[];
  compact?: boolean;
}) {
  if (!hasTechniqueFigure(id)) return null;
  const cast = techniqueCast(cuts, id);
  const caption = techniqueCaption(id, cuts);
  return (
    <figure
      data-technique-figure={id}
      data-tech-letters={techniqueLettersKey(cast)}
      className={compact ? "mt-2" : "mt-3"}
    >
      <TechniqueSvg
        id={id}
        host={cast.host}
        guest={cast.guest}
        extra={cast.extra}
        compact={compact}
      />
      {caption ? (
        <figcaption className="mt-1.5 text-sm leading-snug text-ink-soft">
          <span className="font-medium text-ink">{techniquePlainName(id)}. </span>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function TechniqueFigures({
  ids,
  cuts,
  compact,
}: {
  ids: readonly string[];
  cuts: readonly CutRef[];
  compact?: boolean;
}) {
  const figures = figuresForStep(ids);
  if (!figures.length) return null;
  return (
    <div data-technique-figures={figures.join(",")} className="space-y-2">
      {figures.map((id) => (
        <TechniqueFigure key={id} id={id} cuts={cuts} compact={compact} />
      ))}
    </div>
  );
}

export const TECHNIQUE_FIGURE_IDS = FIGURE_PRIORITY;
