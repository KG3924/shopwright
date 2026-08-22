import { useNavigate } from "@tanstack/react-router";
import { ImageUp, Link2, LoaderCircle, X } from "lucide-react";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { interpretPiece } from "@/lib/ai/interpret";
import { CATALOG } from "@/lib/catalog";
import { fileToDataUrl } from "@/lib/image";
import { useStudio } from "@/lib/store";
import { MAX_PHOTOS } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function HomeView() {
  const navigate = useNavigate();
  const loadCatalog = useStudio((s) => s.loadCatalog);
  const loadProject = useStudio((s) => s.loadProject);
  const rank = useStudio((s) => s.rank);
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"photo" | "url" | null>(null);
  const [drag, setDrag] = useState(false);
  const [staged, setStaged] = useState<string[]>([]);

  function openCatalog(id: string) {
    loadCatalog(id);
    void navigate({ to: "/studio" });
  }

  async function stageFiles(files: FileList | null) {
    if (!files?.length) return;
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (!images.length) {
      toast.error("Drop photos or scans of a plan.");
      return;
    }
    const room = MAX_PHOTOS - staged.length;
    if (room <= 0) {
      toast.error(`Six photos is the cap. Pick the best angles.`);
      return;
    }
    const take = images.slice(0, room);
    if (images.length > room) {
      toast.error(`Kept the first ${room}. Six photos is the cap.`);
    }
    try {
      const urls = await Promise.all(
        take.map((file) => fileToDataUrl(file, 1100, 0.68)),
      );
      setStaged((prev) => [...prev, ...urls].slice(0, MAX_PHOTOS));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read those photos.");
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    void stageFiles(e.dataTransfer.files);
  }

  async function interpretStaged() {
    if (!staged.length) return;
    setBusy("photo");
    try {
      const kind = "photo";
      const result = await interpretPiece({
        data: { imageDataUrls: staged, kind, rank },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      loadProject({ ...result.project, photos: staged, photoDataUrl: staged[0] });
      void navigate({ to: "/studio" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read those photos.");
    } finally {
      setBusy(null);
    }
  }

  async function onUrl(e: FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy("url");
    try {
      const result = await interpretPiece({
        data: {
          url: trimmed,
          kind: "url",
          rank,
          imageDataUrls: staged.length ? staged : undefined,
        },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      loadProject({
        ...result.project,
        photos: staged.length ? staged : result.project.photos,
      });
      void navigate({ to: "/studio" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that link.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:pt-16">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">
        Photo in. Shop packet out.
      </p>
      <h1 className="mt-3 max-w-2xl font-display text-4xl leading-none text-fg sm:text-5xl">
        Build the piece you saw — not a clone, a shop-buildable reading of it.
      </h1>
      <p className="mt-5 max-w-xl text-muted">
        Drop several angles — front, side, underside, a tape in frame. Shopwright
        compiles a cut list, shop drawings, and a tutorial. Then size every
        board, not just the overall box.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`mt-10 rounded-xl border border-dashed p-6 transition-colors duration-200 sm:p-10 ${
          drag ? "border-accent bg-surface-2" : "border-border-strong bg-surface"
        }`}
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-10 items-center justify-center rounded-md bg-surface-2 text-accent">
              <ImageUp className="size-5" />
            </span>
            <div>
              <p className="font-medium">Add photos — more angles, better reading</p>
              <p className="mt-1 max-w-md text-sm text-muted">
                Front, side, back, underside, a detail, a tape. Up to six. Then
                interpret once.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
          >
            Add photos
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void stageFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {staged.length ? (
          <ul className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {staged.map((src, i) => (
              <li key={`${i}-${src.slice(-12)}`} className="relative">
                <img
                  src={src}
                  alt={`Angle ${i + 1}`}
                  className="aspect-square w-full rounded-sm object-cover"
                />
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setStaged((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-sm bg-bg/80 text-fg"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            disabled={busy !== null || staged.length === 0}
            onClick={() => void interpretStaged()}
          >
            {busy === "photo" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            {busy === "photo"
              ? "Reading the photos"
              : staged.length
                ? `Interpret ${staged.length} photo${staged.length === 1 ? "" : "s"}`
                : "Interpret photos"}
          </Button>
          {staged.length ? (
            <button
              type="button"
              className="h-11 text-sm text-muted hover:text-fg"
              onClick={() => setStaged([])}
            >
              Clear photos
            </button>
          ) : null}
        </div>

        <form
          onSubmit={onUrl}
          className="mt-6 flex flex-col gap-2 border-t border-border pt-6 sm:flex-row"
        >
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Or paste a product link"
              className="pl-9"
              inputMode="url"
            />
          </div>
          <Button type="submit" variant="ghost" disabled={busy !== null || !url.trim()}>
            {busy === "url" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : null}
            Interpret link
          </Button>
        </form>
      </div>

      <section className="mt-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl">Studio pieces</h2>
            <p className="mt-1 text-sm text-muted">
              Start from a known form. Same packet — drawings, per-part sizes,
              species, construction.
            </p>
          </div>
        </div>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATALOG.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openCatalog(item.id)}
                className="group flex h-full w-full flex-col overflow-hidden rounded-lg border border-border bg-surface text-left transition-colors duration-200 hover:border-border-strong"
              >
                <span className="relative aspect-[4/3] overflow-hidden bg-surface-2">
                  <img
                    src={item.image}
                    alt=""
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </span>
                <span className="flex flex-1 flex-col p-4">
                  <span className="font-display text-lg">{item.name}</span>
                  <span className="mt-1 text-sm text-muted">{item.blurb}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
