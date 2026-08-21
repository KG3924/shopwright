import { Link } from "@tanstack/react-router";
import { MessageSquare, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DimensionBoard } from "@/components/dimension-board";
import { MasterChat } from "@/components/master-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDimTriplet, formatInches, rankIndex } from "@/lib/format";
import { RANK_META } from "@/lib/ranks";
import { SPECIES } from "@/lib/species";
import { useStudio } from "@/lib/store";
import { RANKS } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = ["Cut list", "Hardware", "Lumber", "Build", "Wood"] as const;
type Tab = (typeof TABS)[number];

export function StudioView() {
  const project = useStudio((s) => s.project);
  const zip = useStudio((s) => s.zip);
  const packetFn = useStudio((s) => s.packet);
  const setOverall = useStudio((s) => s.setOverall);
  const setRoute = useStudio((s) => s.setRoute);
  const setSpecies = useStudio((s) => s.setSpecies);
  const setRank = useStudio((s) => s.setRank);
  const setZip = useStudio((s) => s.setZip);
  const reset = useStudio((s) => s.reset);
  const [tab, setTab] = useState<Tab>("Cut list");
  const [chatOpen, setChatOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const packet = useMemo(() => packetFn(), [packetFn, project, zip]);

  if (!mounted) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-24 text-muted">
        Opening the packet…
      </main>
    );
  }

  if (!project || !packet) {
    return (
      <main className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-3xl">No piece on the bench</h1>
        <p className="mt-3 text-muted">
          Start with a photo, a link, or a studio piece.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/">Back to the shop</Link>
        </Button>
      </main>
    );
  }

  const photo = project.photoDataUrl || project.image;
  const confidencePct = Math.round(project.confidence * 100);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:pt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">
            {project.sourceKind === "catalog" ? "Studio piece" : "Interpretation"}
            {project.overallSource !== "catalog"
              ? ` · ${project.overallSource} size`
              : ""}
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl">{project.name}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setChatOpen(true)}>
            <MessageSquare className="size-4" />
            Ask the Master
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" onClick={() => reset()}>
              <RotateCcw className="size-4" />
              New piece
            </Link>
          </Button>
        </div>
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-12">
        <div className="overflow-hidden rounded-lg border border-border bg-surface lg:col-span-5">
          {photo ? (
            <img
              src={photo}
              alt=""
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div className="aspect-[4/3] bg-surface-2" />
          )}
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={confidencePct >= 80 ? "good" : "warn"}>
                {confidencePct}% confidence
              </Badge>
              <Badge>{project.category}</Badge>
            </div>
            <p className="mt-3 text-sm text-fg/90">{project.interpretation}</p>
            {project.uncertainties.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider text-muted">
                  Not visible — inferred
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted">
                  {project.uncertainties.map((u) => (
                    <li key={u} className="border-l border-border-strong pl-3">
                      {u}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-7">
          <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
            <p className="text-xs uppercase tracking-wider text-muted">
              Fit to the space
            </p>
            <p className="mt-1 text-sm text-muted">
              Change one overall size. Parts that depend on it move with it.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["w", "Width", 12, 96],
                  ["d", "Depth", 8, 48],
                  ["h", "Height", 8, 84],
                ] as const
              ).map(([key, label, min, max]) => (
                <label key={key} className="block">
                  <span className="flex items-baseline justify-between text-sm">
                    <span>{label}</span>
                    <span className="font-mono tabular-nums text-muted">
                      {formatInches(project.overall[key])}
                    </span>
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={0.25}
                    value={project.overall[key]}
                    onChange={(e) =>
                      setOverall({ [key]: Number(e.target.value) })
                    }
                    className="mt-2 h-11 w-full accent-accent"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4">
              <DimensionBoard overall={project.overall} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
            <p className="text-xs uppercase tracking-wider text-muted">
              How the underside goes together
            </p>
            <div className="mt-3 grid gap-2">
              {project.routes.map((route) => {
                const active = route.id === project.routeId;
                return (
                  <button
                    key={route.id}
                    type="button"
                    onClick={() => setRoute(route.id)}
                    className={cn(
                      "rounded-md border px-3 py-3 text-left transition-colors duration-150",
                      active
                        ? "border-accent bg-surface-2"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{route.name}</span>
                      <Badge
                        tone={
                          rankIndex(project.rank) >=
                          rankIndex(route.recommendedRank)
                            ? "good"
                            : "warn"
                        }
                      >
                        {RANK_META[route.recommendedRank].label}
                      </Badge>
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      {route.summary}
                    </span>
                    {active ? (
                      <span className="mt-2 block text-sm text-fg/80">
                        Tradeoff: {route.tradeoffs} Hidden work:{" "}
                        {route.hiddenWork}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-border bg-surface p-4 sm:p-5 lg:col-span-8">
          <p className="text-xs uppercase tracking-wider text-muted">Your rank</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {RANKS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRank(r)}
                className={cn(
                  "h-11 rounded-md border text-sm transition-colors",
                  project.rank === r
                    ? "border-accent bg-accent text-accent-fg"
                    : "border-border text-muted hover:text-fg",
                )}
              >
                {RANK_META[r].label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">{RANK_META[project.rank].shop}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4 sm:p-5 lg:col-span-4">
          <p className="text-xs uppercase tracking-wider text-muted">
            Lumber ZIP
          </p>
          <Input
            className="mt-3"
            value={zip}
            onChange={(e) =>
              setZip(e.target.value.replace(/[^\d]/g, "").slice(0, 5))
            }
            inputMode="numeric"
            placeholder="75013"
          />
          <p className="mt-2 text-sm text-muted">
            Allen / North Dallas is mapped in detail. Other ZIPs fall back to
            big-box.
          </p>
        </div>
      </section>

      {packet.warnings.length ? (
        <ul className="mt-4 space-y-2">
          {packet.warnings.map((w) => (
            <li
              key={w}
              className="rounded-md border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn"
            >
              {w}
            </li>
          ))}
        </ul>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-xl bg-paper text-ink">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 px-4 py-3 sm:px-6">
          <p className="font-display text-xl">Shop packet</p>
          <p className="font-mono text-xs text-ink-soft">
            {packet.boardFeet.toFixed(1)} bd ft · ~{packet.weightLb} lb in{" "}
            {packet.species.name}
          </p>
        </div>
        <div className="flex gap-1 overflow-x-auto px-2 pt-2 sm:px-4">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "h-10 shrink-0 rounded-sm px-3 text-sm",
                tab === t ? "bg-ink text-paper" : "text-ink-soft hover:text-ink",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {tab === "Cut list" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wider text-ink-soft">
                  <tr>
                    <th className="pb-2 font-medium">Qty</th>
                    <th className="pb-2 font-medium">Part</th>
                    <th className="pb-2 font-medium">L × W × T</th>
                    <th className="pb-2 font-medium">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {packet.cuts.map((c) => (
                    <tr key={c.id} className="border-t border-ink/10">
                      <td className="py-2 font-mono tabular-nums">{c.qty}</td>
                      <td className="py-2">
                        {c.name}
                        {c.notes ? (
                          <span className="mt-0.5 block text-xs text-ink-soft">
                            {c.notes}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 font-mono tabular-nums">
                        {formatDimTriplet(c.length, c.width, c.thickness)}
                      </td>
                      <td className="py-2 capitalize text-ink-soft">{c.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === "Hardware" ? (
            <ul className="space-y-3">
              {packet.hardware.map((h) => (
                <li key={h.id} className="flex gap-4 border-b border-ink/10 pb-3">
                  <span className="font-mono tabular-nums text-ink-soft">
                    {h.qty}×
                  </span>
                  <span>
                    <span className="block font-medium">{h.name}</span>
                    <span className="text-sm text-ink-soft">
                      {h.spec} · {h.aisle}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "Lumber" ? (
            <ul className="space-y-3">
              {packet.sources.map((s) => (
                <li key={s.id} className="border-b border-ink/10 pb-3">
                  <p className="font-medium">
                    {s.name}
                    <span className="ml-2 font-sans text-sm font-normal text-ink-soft">
                      {s.city}
                      {s.miles ? ` · ${s.miles} mi` : ""}
                    </span>
                  </p>
                  <p className="text-sm text-ink-soft">{s.carries}</p>
                  <p className="mt-1 text-sm">{s.note}</p>
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "Build" ? (
            <ol className="space-y-6">
              {packet.steps.map((step, i) => (
                <li key={step.id}>
                  <p className="font-mono text-xs text-ink-soft">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-1 font-display text-xl">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed">{step.body}</p>
                  {packet.techniques.filter((t) =>
                    step.techniques.includes(t.id),
                  ).length ? (
                    <div className="mt-3 space-y-2 rounded-md bg-ink/5 p-3">
                      {packet.techniques
                        .filter((t) => step.techniques.includes(t.id))
                        .map((t) => (
                          <details key={t.id}>
                            <summary className="cursor-pointer text-sm font-medium">
                              Technique: {t.name}
                            </summary>
                            <p className="mt-2 text-sm text-ink-soft">{t.body}</p>
                            {t.safety ? (
                              <p className="mt-2 text-sm text-ink">
                                Safety — {t.safety}
                              </p>
                            ) : null}
                          </details>
                        ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}

          {tab === "Wood" ? (
            <div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {SPECIES.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => setSpecies(sp.id)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-sm",
                      packet.species.id === sp.id
                        ? "border-ink bg-ink text-paper"
                        : "border-ink/15 hover:border-ink/40",
                    )}
                  >
                    <span className="block font-medium">{sp.name}</span>
                    <span className="text-xs opacity-70">{sp.cost}</span>
                  </button>
                ))}
              </div>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <Fact label="In the room" value={packet.species.indoor} />
                <Fact label="Stain" value={packet.species.stain} />
                <Fact label="Weather" value={packet.species.weather} />
                <Fact label="Movement" value={packet.species.movement} />
                <Fact
                  label="Weight of this cut list"
                  value={`~${packet.weightLb} lb at ${packet.species.density} lb/ft³ · Janka ${packet.species.janka}`}
                />
                <Fact label="Where to buy" value={packet.species.typicalStock} />
              </dl>
              <p className="mt-4 text-sm text-ink-soft">{packet.species.notes}</p>
            </div>
          ) : null}
        </div>
      </section>

      <MasterChat open={chatOpen} onClose={() => setChatOpen(false)} />
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ink-soft">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}
