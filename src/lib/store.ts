import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CATALOG } from "./catalog";
import { compilePacket, instantiate } from "./compile";
import { defaultZip } from "./sourcing";
import type { ChatMessage, Overall, Project, Rank, ShopPacket } from "./types";

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
  loadCatalog: (id: string) => void;
  loadProject: (project: Project) => void;
  reset: () => void;
  addChat: (msg: ChatMessage) => void;
  clearChat: () => void;
  packet: () => ShopPacket | null;
};

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
      loadCatalog: (id) => {
        const template = CATALOG.find((p) => p.id === id);
        if (!template) return;
        const { rank } = get();
        set({
          project: instantiate(template, { rank }),
          chat: [],
        });
      },
      loadProject: (project) => set({ project, chat: [] }),
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
      name: "shopwright-v01",
      partialize: (s) => ({
        rank: s.rank,
        zip: s.zip,
        project: s.project
          ? { ...s.project, photoDataUrl: undefined }
          : null,
      }),
    },
  ),
);
