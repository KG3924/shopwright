import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CATALOG } from "./catalog";
import { compilePacket, instantiate } from "./compile";
import { defaultZip } from "./sourcing";
import type {
  ChatMessage,
  Overall,
  PartOverride,
  Project,
  Rank,
  ShopPacket,
} from "./types";
import { MAX_PHOTOS } from "./types";

type StudioState = {
  rank: Rank;
  zip: string;
  project: Project | null;
  chat: ChatMessage[];
  setRank: (rank: Rank) => void;
  setZip: (zip: string) => void;
  setSpecies: (id: string) => void;
  setRoute: (id: string) => void;
  setOverall: (overall: Partial<Overall>) => void;
  setPartOverride: (partId: string, patch: PartOverride) => void;
  clearPartOverride: (partId: string, key?: keyof PartOverride) => void;
  addPhotos: (urls: string[]) => void;
  removePhoto: (index: number) => void;
  loadCatalog: (id: string) => void;
  loadProject: (project: Project) => void;
  reset: () => void;
  addChat: (msg: ChatMessage) => void;
  clearChat: () => void;
  packet: () => ShopPacket | null;
};

function withPhotos(project: Project, photos: string[]): Project {
  const next = photos.slice(0, MAX_PHOTOS);
  return { ...project, photos: next, photoDataUrl: next[0] };
}

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      rank: "beginner",
      zip: defaultZip(),
      project: null,
      chat: [],
      setRank: (rank) => {
        const project = get().project;
        set({ rank, project: project ? { ...project, rank } : null });
      },
      setZip: (zip) => set({ zip }),
      setSpecies: (id) => {
        const project = get().project;
        if (!project) return;
        set({ project: { ...project, speciesId: id } });
      },
      setRoute: (id) => {
        const project = get().project;
        if (!project) return;
        set({ project: { ...project, routeId: id }, chat: [] });
      },
      setOverall: (overall) => {
        const project = get().project;
        if (!project) return;
        set({
          project: {
            ...project,
            overall: { ...project.overall, ...overall },
          },
        });
      },
      setPartOverride: (partId, patch) => {
        const project = get().project;
        if (!project) return;
        const prev = project.partOverrides ?? {};
        set({
          project: {
            ...project,
            partOverrides: {
              ...prev,
              [partId]: { ...prev[partId], ...patch },
            },
          },
        });
      },
      clearPartOverride: (partId, key) => {
        const project = get().project;
        if (!project) return;
        const prev = { ...(project.partOverrides ?? {}) };
        if (!key) {
          delete prev[partId];
        } else if (prev[partId]) {
          const next = { ...prev[partId] };
          delete next[key];
          if (!Object.keys(next).length) delete prev[partId];
          else prev[partId] = next;
        }
        set({ project: { ...project, partOverrides: prev } });
      },
      addPhotos: (urls) => {
        const project = get().project;
        if (!project || !urls.length) return;
        const existing = project.photos?.length
          ? project.photos
          : project.image
            ? [project.image]
            : [];
        set({
          project: withPhotos(project, [...existing, ...urls]),
        });
      },
      removePhoto: (index) => {
        const project = get().project;
        if (!project?.photos) return;
        set({
          project: withPhotos(
            project,
            project.photos.filter((_, i) => i !== index),
          ),
        });
      },
      loadCatalog: (id) => {
        const template = CATALOG.find((p) => p.id === id);
        if (!template) return;
        const { rank } = get();
        set({
          project: instantiate(template, { rank }),
          chat: [],
        });
      },
      loadProject: (project) =>
        set({
          project: {
            ...project,
            photos: project.photos ?? (project.photoDataUrl ? [project.photoDataUrl] : []),
            partOverrides: project.partOverrides ?? {},
          },
          chat: [],
        }),
      reset: () => set({ project: null, chat: [] }),
      addChat: (msg) => set({ chat: [...get().chat, msg] }),
      clearChat: () => set({ chat: [] }),
      packet: () => {
        const { project, zip } = get();
        if (!project) return null;
        return compilePacket(project, zip);
      },
    }),
    {
      name: "shopwright-v02",
      partialize: (s) => ({
        rank: s.rank,
        zip: s.zip,
        project: s.project
          ? {
              ...s.project,
              photoDataUrl: undefined,
              photos: (s.project.photos ?? []).filter((p) => !p.startsWith("data:")),
            }
          : null,
      }),
    },
  ),
);
