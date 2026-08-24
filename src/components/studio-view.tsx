import { Link } from "@tanstack/react-router";
import {
  Hammer,
  ImageUp,
  Layers,
  ListChecks,
  MessageSquare,
  RotateCcw,
  Ruler,
  TreePine,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { InchField } from "@/components/inch-field";
import { InterpretBusyStatus } from "@/components/interpret-busy";
import { MasterChat } from "@/components/master-chat";
import { DoNotCutCallout, ShopDrawings } from "@/components/shop-drawings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { interpretPiece } from "@/lib/ai/interpret";
import { mapInterpretHandlerError } from "@/lib/ai/url-source";
import { fileToDataUrl } from "@/lib/image";
import { formatInches } from "@/lib/format";
import {
  DONT_CUT_YET,
  cutHoldFromPacket,
  editorAxisValue,
  formatCutAxis,
  formatCutAxisSource,
  isHoldWarning,
  offersStockThicknessPick,
  STOCK_THICKNESS_INCHES,
} from "@/lib/measure";
import { PACKET_COPY } from "@/lib/plain-copy";
import { RANK_META } from "@/lib/ranks";
import { NO_ROUTE_NAME, normalizeTools, SHOP_TOOL_META, statusForRoute } from "@/lib/routes";
import { SPECIES } from "@/lib/species";
import { useStudio } from "@/lib/store";
import { MAX_PHOTOS, projectPhotos, RANKS, SHOP_TOOLS } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = ["Drawings", "Cut list", "Hardware", "Lumber", "Build", "Wood"] as const;
type Tab = (typeof TABS)[number];

const TAB_ICON: Record<Tab, typeof Ruler> = {
  Drawings: Ruler,
  "Cut list": ListChecks,
  Hardware: Wrench,
  Lumber: Layers,
  Build: Hammer,
  Wood: TreePine,
};

export function StudioView() {
  const project = useStudio((s) => s.project);
  const zip = useStudio((s) => s.zip);
  const packetFn = useStudio((s) => s.packet);
  const setOverall = useStudio((s) => s.setOverall);
  const setRoute = useStudio((s) => s.setRoute);
  const setSpecies = useStudio((s) => s.setSpecies);
  const setRank = useStudio((s) => s.setRank);
  const toggleToolAvailable = useStudio((s) => s.toggleToolAvailable);
  const setZip = useStudio((s) => s.setZip);
  const setPartOverride = useStudio((s) => s.setPartOverride);
  const clearPartOverride = useStudio((s) => s.clearPartOverride);
  const addPhotos = useStudio((s) => s.addPhotos);
  const removePhoto = useStudio((s) => s.removePhoto);
  const loadProject = useStudio((s) => s.loadProject);
  const reset = useStudio((s) => s.reset);
  const rank = useStudio((s) => s.rank);
  const toolsAvailable = useStudio((s) => s.toolsAvailable);
  const [tab, setTab] = useState<Tab>("Drawings");
  const [chatOpen, setChatOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
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
        <h1 className="font-display text-3xl">{PACKET_COPY.studioEmptyTitle}</h1>
        <p className="mt-3 text-muted">
          {PACKET_COPY.studioEmptyBody}
        </p>
        <Button className="mt-6" asChild>
          <Link to="/">Back to the shop</Link>
        </Button>
      </main>
    );
  }

  const photos = projectPhotos(project);
  const confidencePct = Math.round(project.confidence * 100);
  const cutHold = cutHoldFromPacket(packet);
  const extraWarnings = packet.warnings.filter((w) => !isHoldWarning(w));

  async function onAddPhotos(files: FileList | null) {
    if (!files?.length || !project || busy) return;
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error("Six photos is the cap.");
      return;
    }
    try {
      const urls = await Promise.all(
        images.slice(0, room).map((f) => fileToDataUrl(f, 1100, 0.68)),
      );
      addPhotos(urls);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add those photos.");
    }
  }

  async function reread() {
    if (!project || busy) return;
    const dataUrls = photos.filter((p) => p.startsWith("data:"));
    if (!dataUrls.length) {
      toast.error("Add a photo you took — catalog shots are already in the packet.");
      return;
    }
    setBusy(true);
    try {
      const result = await interpretPiece({
        data: {
          imageDataUrls: dataUrls,
          kind: project.sourceKind === "blueprint" ? "blueprint" : "photo",
          rank,
          toolsAvailable,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      loadProject({
        ...result.project,
        overall: project.overall,
        partOverrides: project.partOverrides,
        routeId: project.routeId,
        speciesId: project.speciesId,
        rank: project.rank,
        toolsAvailable: project.toolsAvailable ?? toolsAvailable,
        photos,
        photoDataUrl: photos[0],
      });
      toast.success("Reading updated from the new angles. Sizes you set were kept.");
    } catch (err) {
      toast.error(mapInterpretHandlerError(err, "Could not re-read.").error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:pt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">
            {project.sourceKind === "catalog" ? "Studio piece" : "Interpretation"}
            {` · ${packet.route.name}`}
            {project.overallSource !== "catalog"
              ? ` · ${project.overallSource} size`
              : ""}
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl">{project.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              tone={packet.routeRunnable ? "muted" : "warn"}
              data-compile-route={packet.route.id}
            >
              {packet.route.name}
            </Badge>
            {!packet.routeRunnable ? (
              <Badge tone="warn">{DONT_CUT_YET}</Badge>
            ) : null}
          </div>
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
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-bench)] lg:col-span-5">
          {photos[0] ? (
            <img
              src={photos[0]}
              alt=""
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div className="aspect-[4/3] bg-surface-2" />
          )}
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={confidencePct >= 80 ? "good" : "warn"}>
                {confidencePct}% form
              </Badge>
              {project.drawing?.constructionConfidence != null ? (
                <Badge
                  tone={project.drawing.constructionConfidence >= 0.7 ? "good" : "warn"}
                >
                  {Math.round(project.drawing.constructionConfidence * 100)}% joinery
                </Badge>
              ) : null}
              {packet.doNotCut ? (
                <Badge tone="warn">{DONT_CUT_YET}</Badge>
              ) : null}
              {project.scaleConfidence === "high" ? (
                <Badge tone="good">Scale high</Badge>
              ) : project.scaleConfidence ? (
                <Badge tone="warn">Scale {project.scaleConfidence}</Badge>
              ) : null}
              <Badge>{project.category}</Badge>
              {photos.length > 1 ? (
                <Badge>{photos.length} angles</Badge>
              ) : null}
            </div>
            <ul className="mt-3 grid grid-cols-5 gap-1.5">
              {photos.map((src, i) => (
                <li key={`${i}-${src.slice(-8)}`} className="relative">
                  <img
                    src={src}
                    alt={`Photo ${i + 1}`}
                    className="aspect-square w-full rounded-xs object-cover"
                  />
                  <span className="pointer-events-none absolute bottom-0.5 left-0.5 rounded-xs bg-ink/75 px-1 font-mono text-[10px] text-paper">
                    {i + 1}
                  </span>
                  {src.startsWith("data:") ? (
                    <button
                      type="button"
                      aria-label={`Remove photo ${i + 1}`}
                      disabled={busy}
                      onClick={() => removePhoto(i)}
                      className="absolute right-0.5 top-0.5 flex size-7 items-center justify-center rounded-xs bg-ink/80 text-paper disabled:opacity-40"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <li>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => photoRef.current?.click()}
                    className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xs border border-dashed border-border text-muted disabled:opacity-40"
                  >
                    <ImageUp className="size-4" />
                    <span className="text-[10px]">Add</span>
                  </button>
                </li>
              ) : null}
            </ul>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void onAddPhotos(e.target.files);
                e.target.value = "";
              }}
            />
            {busy ? <InterpretBusyStatus kind="photo" className="mt-3" /> : null}
            <div className="mt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void reread()}
              >
                Re-read with these angles
              </Button>
            </div>
            <p className="mt-3 text-sm text-fg/90">{project.interpretation}</p>
            {project.uncertainties.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider text-muted">
                  {project.sourceKind === "catalog"
                    ? PACKET_COPY.inferredCatalog
                    : PACKET_COPY.inferred}
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
              Fit the overall piece
            </p>
            <p className="mt-1 text-sm text-muted">
              {PACKET_COPY.studioFit}
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
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
            <p className="text-xs uppercase tracking-wider text-muted">
              {PACKET_COPY.toolsTitle}
            </p>
            <p className="mt-1 text-sm text-muted">{PACKET_COPY.toolsBlurb}</p>
            <p className="mt-4 text-xs uppercase tracking-wider text-muted">
              Tools available
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SHOP_TOOLS.map((tool) => {
                const on = normalizeTools(
                  project.toolsAvailable ?? toolsAvailable,
                ).includes(tool);
                return (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => toggleToolAvailable(tool)}
                    className={cn(
                      "h-10 rounded-md border px-3 text-sm transition-colors",
                      on
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-border text-muted hover:text-fg",
                    )}
                  >
                    {SHOP_TOOL_META[tool]}
                  </button>
                );
              })}
            </div>
            <details className="mt-4" data-rank-advanced>
              <summary className="cursor-pointer text-sm text-muted">
                {PACKET_COPY.rankAdvanced}
              </summary>
              <p className="mt-2 text-sm text-muted">{PACKET_COPY.rankHint}</p>
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
            </details>
          </div>

          <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
            <p className="text-xs uppercase tracking-wider text-muted">
              {PACKET_COPY.routesTitle}
            </p>
            <div className="mt-3 grid gap-2">
              {project.routes.map((route) => {
                const benchTools = normalizeTools(
                  project.toolsAvailable ?? toolsAvailable,
                );
                const status = statusForRoute(route, project.rank, benchTools);
                const compiled =
                  packet.routeRunnable && route.id === packet.route.id;
                const pickerSelected = route.id === project.routeId;
                return (
                  <button
                    key={route.id}
                    type="button"
                    disabled={!status.runnable}
                    data-route-id={route.id}
                    data-compiled={compiled ? "true" : "false"}
                    data-picker-selected={pickerSelected ? "true" : "false"}
                    onClick={() => {
                      if (!status.runnable) return;
                      setRoute(route.id);
                    }}
                    className={cn(
                      "rounded-md border px-3 py-3 text-left transition-colors duration-150",
                      !status.runnable && "cursor-not-allowed opacity-60",
                      compiled
                        ? "border-accent bg-surface-2"
                        : pickerSelected
                          ? "border-border-strong"
                          : "border-border",
                      status.runnable && !compiled && "hover:border-border-strong",
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{route.name}</span>
                      <Badge tone={compiled ? "good" : "warn"}>
                        {RANK_META[route.recommendedRank].label}
                      </Badge>
                    </span>
                    <span className="mt-1 block text-sm text-muted">
                      {route.summary}
                    </span>
                    {!status.runnable ? (
                      <span className="mt-2 block text-sm text-warn">
                        {status.reasons.join(" · ")}
                        {pickerSelected && !packet.routeRunnable
                          ? ` · ${NO_ROUTE_NAME} — ${DONT_CUT_YET}`
                          : ""}
                      </span>
                    ) : compiled ? (
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
          <p className="text-sm text-muted">
            {PACKET_COPY.routesBlurb}
          </p>
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
            Allen / North Dallas is mapped in detail. 70769 names Gonzales HD
            and Lowe's. Other ZIPs fall back to big-box.
          </p>
        </div>
      </section>

      {cutHold ? (
        <div className="mt-4 print:hidden">
          <DoNotCutCallout hold={cutHold} />
        </div>
      ) : null}
      {extraWarnings.length ? (
        <ul className="mt-4 space-y-2">
          {extraWarnings.map((w) => (
            <li
              key={w}
              className="rounded-[2rem] border border-warn/30 bg-warn/10 px-5 py-3 text-sm text-warn"
            >
              {w}
            </li>
          ))}
        </ul>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-xl border border-ink/10 bg-paper text-ink shadow-[var(--shadow-bench)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 px-4 py-3 sm:px-6">
          <p className="font-display text-xl">Shop packet</p>
          <p className="font-mono text-xs text-ink-soft">
            {packet.boardFeet.toFixed(1)} bd ft · ~{packet.weightLb} lb in{" "}
            {packet.species.name}
          </p>
        </div>
        <div className="flex gap-1 overflow-x-auto px-2 pt-2 print:hidden sm:px-4">
          {TABS.map((t) => {
            const Icon = TAB_ICON[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-1.5 rounded-sm px-3 text-sm",
                  tab === t ? "bg-accent text-accent-fg" : "text-ink-soft hover:text-ink",
                )}
              >
                <Icon className="size-3.5" />
                {t}
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-6">
          <div
            className={cn(
              "shop-print-packet",
              tab !== "Drawings" && "hidden print:block",
            )}
          >
            <ShopDrawings packet={packet} />
          </div>

          {tab === "Cut list" ? (
            <div className="space-y-4">
              <p className="text-sm text-ink-soft">
                {PACKET_COPY.cutList}
              </p>
              <div className="overflow-x-auto print:hidden">
                <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink/20 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                      <th className="py-2 pr-2 font-normal">#</th>
                      <th className="py-2 pr-2 font-normal">Part</th>
                      <th className="py-2 pr-2 font-normal">Qty</th>
                      <th className="py-2 pr-2 font-normal">T</th>
                      <th className="py-2 pr-2 font-normal">W</th>
                      <th className="py-2 pr-2 font-normal">L</th>
                      <th className="py-2 font-normal">From</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packet.cuts.map((c) => (
                      <tr key={`sum-${c.id}`} className="border-b border-ink/10">
                        <td className="py-1.5 pr-2 font-mono">{c.letter}</td>
                        <td className="py-1.5 pr-2">{c.name}</td>
                        <td className="py-1.5 pr-2 font-mono">{c.qty}</td>
                        <StudioDimCell cut={c} axis="thickness" />
                        <StudioDimCell cut={c} axis="width" />
                        <StudioDimCell cut={c} axis="length" />
                        <td className="py-1.5 text-ink-soft">{c.fromStock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-4">
                {packet.cuts.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-md border border-ink/10 p-3 sm:p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          <span className="mr-2 font-mono text-ink-soft">
                            {c.letter}
                          </span>
                          {c.name}
                        </p>
                        {c.notes ? (
                          <p className="mt-0.5 text-xs text-ink-soft">{c.notes}</p>
                        ) : null}
                        <p className="mt-1 font-mono text-xs text-ink-soft">
                          From {c.fromStock}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs capitalize text-ink-soft">
                          {c.stock}
                        </span>
                        {c.locked.length ||
                        c.locked.width ||
                        c.locked.thickness ||
                        c.locked.qty ? (
                          <button
                            type="button"
                            className="text-xs underline-offset-2 hover:underline"
                            onClick={() => clearPartOverride(c.id)}
                          >
                            Reset part
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-wider text-ink-soft">
                          Qty
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={40}
                          value={c.qty}
                          onChange={(e) =>
                            setPartOverride(c.id, {
                              qty: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="mt-1 h-11 w-full rounded-sm border border-ink/15 bg-paper px-2 font-mono text-sm text-ink"
                        />
                      </label>
                      <InchField
                        label="Length"
                        value={editorAxisValue(c, "length")}
                        locked={c.locked.length}
                        follows={c.follows.length}
                        hint={formatCutAxisSource(c, "length") || undefined}
                        onCommit={(n) => setPartOverride(c.id, { length: n })}
                        onUnlock={() => clearPartOverride(c.id, "length")}
                      />
                      <InchField
                        label="Width"
                        value={editorAxisValue(c, "width")}
                        locked={c.locked.width}
                        follows={c.follows.width}
                        hint={formatCutAxisSource(c, "width") || undefined}
                        onCommit={(n) => setPartOverride(c.id, { width: n })}
                        onUnlock={() => clearPartOverride(c.id, "width")}
                      />
                      <InchField
                        label="Thickness"
                        value={editorAxisValue(c, "thickness")}
                        locked={c.locked.thickness}
                        follows={c.follows.thickness}
                        hint={formatCutAxisSource(c, "thickness") || undefined}
                        picks={
                          offersStockThicknessPick(c) ? STOCK_THICKNESS_INCHES : undefined
                        }
                        onCommit={(n) => setPartOverride(c.id, { thickness: n })}
                        onUnlock={() => clearPartOverride(c.id, "thickness")}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tab === "Hardware" ? (
            <ul className="space-y-3">
              {packet.hardware.map((h) => (
                <li key={h.id} className="border-b border-ink/10 pb-3">
                  <span className="flex gap-4">
                    <span className="font-mono tabular-nums text-ink-soft">
                      {h.qty}×
                    </span>
                    <span>
                      <span className="block font-medium">{h.name}</span>
                      <span className="text-sm text-ink-soft">
                        {h.spec} · {h.aisle}
                      </span>
                    </span>
                  </span>
                  {h.where ? (
                    <p className="mt-2 pl-10 text-sm leading-relaxed">
                      {h.where}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {tab === "Lumber" ? (
            <div className="space-y-6">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                  Your lumber
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  {packet.boards.reduce((s, b) => s + b.bdft, 0).toFixed(1)} nom.
                  bd ft on the rack · {packet.boardFeet.toFixed(1)} net in the
                  parts.
                </p>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {packet.boards.map((b) => (
                    <li
                      key={b.id}
                      className="rounded-sm border border-ink/10 p-3"
                    >
                      <p className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-wider text-ink-soft">
                        <span>{b.label}</span>
                        <span>
                          {b.stock}
                          {b.spare ? " · spare" : ""}
                        </span>
                      </p>
                      <p className="mt-1 text-sm font-medium">{b.role}</p>
                      <p className="mt-1 font-mono text-xs text-ink-soft">
                        {b.yields}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed">{b.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
              {packet.stillBuy.length ? (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                    Still buy
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                    {packet.stillBuy.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {packet.doNotBuy.length ? (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                    Do not buy
                  </p>
                  <p className="mt-2 text-sm">{packet.doNotBuy.join(" · ")}</p>
                </div>
              ) : null}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                  Yards for this ZIP
                </p>
                <ul className="mt-3 space-y-3">
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
              </div>
            </div>
          ) : null}

          {tab === "Build" ? (
            <ol className="space-y-6">
              {!packet.routeRunnable ? (
                <li>
                  <DoNotCutCallout
                    hold={
                      cutHold ?? {
                        headline: DONT_CUT_YET,
                        notes: ["No construction route compiled — do not cut."],
                        text: `${DONT_CUT_YET}. No construction route compiled — do not cut.`,
                      }
                    }
                  />
                </li>
              ) : null}
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

function StudioDimCell({
  cut,
  axis,
}: {
  cut: Parameters<typeof formatCutAxis>[0];
  axis: Parameters<typeof formatCutAxisSource>[1];
}) {
  const source = formatCutAxisSource(cut, axis);
  return (
    <td className="py-1.5 pr-2 font-mono">
      <span className="block">{formatCutAxis(cut, axis)}</span>
      {source ? (
        <span className="mt-0.5 block font-sans text-[10px] font-normal leading-snug text-ink-soft">
          {source}
        </span>
      ) : null}
    </td>
  );
}
