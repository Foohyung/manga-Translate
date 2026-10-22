import { create } from 'zustand';
import type { GlossaryEntry } from '@/lib/glossary';
import type { TranslationStyle } from '@/lib/glossary/style';
import type { Box } from '@/lib/geometry';
import { readImageSize } from '@/lib/image';
import type { SourceLanguage, TargetLanguage } from '@/lib/languages';
import { createId, type Page, type TextLayer, type TextStyle } from '@/lib/project';
import * as storage from '@/lib/storage';

export type PageTask = 'extract' | 'translate' | 'clean';
export type PanelTab = 'texts' | 'style' | 'glossary';

interface ProjectState {
  status: 'loading' | 'ready';
  pages: Page[];
  activePageId: string | null;
  selectedLayerId: string | null;
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  /** The project's own translations for names and terms. */
  glossary: GlossaryEntry[];
  useBuiltInGlossary: boolean;
  translationStyle: TranslationStyle;
  /** Work currently running on each page. */
  pageTasks: Partial<Record<string, PageTask>>;
  panelTab: PanelTab;
  /** Incremented to ask the inspector to focus the text field. */
  textEditRequest: number;
}

interface ProjectActions {
  load: () => Promise<void>;
  /** Adds image files as pages, in file-name order. Returns how many were readable images. */
  addPages: (files: readonly File[]) => Promise<number>;
  removePage: (pageId: string) => void;
  setActivePage: (pageId: string) => void;
  setSourceLanguage: (language: SourceLanguage) => void;
  setTargetLanguage: (language: TargetLanguage) => void;
  setGlossary: (glossary: GlossaryEntry[]) => void;
  setUseBuiltInGlossary: (use: boolean) => void;
  setTranslationStyle: (style: TranslationStyle) => void;
  setLayers: (pageId: string, layers: TextLayer[]) => void;
  mapLayers: (pageId: string, update: (layer: TextLayer) => TextLayer) => void;
  addLayer: (pageId: string, layer: TextLayer) => void;
  addEraseArea: (pageId: string, area: Box) => void;
  removeEraseArea: (pageId: string, index: number) => void;
  updateLayer: (pageId: string, layerId: string, patch: Partial<Omit<TextLayer, 'id'>>) => void;
  updateLayerStyle: (pageId: string, layerId: string, patch: Partial<TextStyle>) => void;
  removeLayer: (pageId: string, layerId: string) => void;
  /** `inspect` also opens the style panel. */
  selectLayer: (layerId: string | null, options?: { inspect?: boolean }) => void;
  setPanelTab: (tab: PanelTab) => void;
  requestTextEdit: (layerId: string) => void;
  setCleanedImage: (pageId: string, image: Blob | null) => void;
  setPageTask: (pageId: string, task: PageTask | null) => void;
  clearProject: () => Promise<void>;
}

const initialState: ProjectState = {
  status: 'loading',
  pages: [],
  activePageId: null,
  selectedLayerId: null,
  sourceLanguage: 'auto',
  targetLanguage: 'th',
  glossary: [],
  useBuiltInGlossary: true,
  translationStyle: 'natural',
  pageTasks: {},
  panelTab: 'texts',
  textEditRequest: 0,
};

let loading: Promise<void> | null = null;

export const useProjectStore = create<ProjectState & ProjectActions>()((set, get) => {
  const updatePage = (pageId: string, update: (page: Page) => Page) =>
    set((state) => ({ pages: state.pages.map((page) => (page.id === pageId ? update(page) : page)) }));

  const updateLayers = (pageId: string, update: (layers: TextLayer[]) => TextLayer[]) =>
    updatePage(pageId, (page) => ({ ...page, layers: update(page.layers) }));

  return {
    ...initialState,

    load() {
      loading ??= (async () => {
        const saved = await storage.loadProject().catch((error: unknown) => {
          console.warn('Could not restore the saved project.', error);
          return null;
        });
        if (saved) {
          const pages = saved.pages.map((page) => ({
            ...page,
            // Projects saved before text shapes existed.
            layers: page.layers.map((layer) => ({
              ...layer,
              shape: layer.shape ?? 'rect',
              erase: layer.erase ?? layer.sourceBox !== null,
            })),
            manualEraseAreas: page.manualEraseAreas ?? [],
            originalUrl: URL.createObjectURL(page.original),
            cleanedUrl: page.cleaned && URL.createObjectURL(page.cleaned),
          }));
          set({
            pages,
            activePageId: pages.some((page) => page.id === saved.activePageId)
              ? saved.activePageId
              : (pages[0]?.id ?? null),
            sourceLanguage: saved.sourceLanguage,
            targetLanguage: saved.targetLanguage,
            glossary: saved.glossary ?? [],
            useBuiltInGlossary: saved.useBuiltInGlossary ?? true,
            translationStyle: saved.translationStyle ?? 'natural',
          });
        }
        set({ status: 'ready' });
        startAutosave();
      })();
      return loading;
    },

    async addPages(files) {
      const images = files
        .filter((file) => file.type.startsWith('image/'))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const pages = (await Promise.all(images.map(createPage))).filter((page) => page !== null);
      if (pages.length === 0) return 0;

      set((state) => ({
        pages: [...state.pages, ...pages],
        activePageId: state.activePageId ?? pages[0].id,
      }));
      pages.forEach((page) => persist(storage.saveImage(page.id, 'original', page.original)));
      return pages.length;
    },

    removePage(pageId) {
      const { pages, activePageId, selectedLayerId } = get();
      const index = pages.findIndex((page) => page.id === pageId);
      if (index < 0) return;

      revokeUrls(pages[index]);
      const remaining = pages.filter((page) => page.id !== pageId);
      const wasActive = activePageId === pageId;
      set({
        pages: remaining,
        activePageId: wasActive ? (remaining[Math.min(index, remaining.length - 1)]?.id ?? null) : activePageId,
        selectedLayerId: wasActive ? null : selectedLayerId,
      });
      persist(storage.deletePageImages(pageId));
    },

    setActivePage: (pageId) => set({ activePageId: pageId, selectedLayerId: null }),
    setSourceLanguage: (sourceLanguage) => set({ sourceLanguage }),
    setTargetLanguage: (targetLanguage) => set({ targetLanguage }),
    setGlossary: (glossary) => set({ glossary }),
    setUseBuiltInGlossary: (useBuiltInGlossary) => set({ useBuiltInGlossary }),
    setTranslationStyle: (translationStyle) => set({ translationStyle }),

    setLayers(pageId, layers) {
      updateLayers(pageId, () => layers);
      if (get().activePageId === pageId) set({ selectedLayerId: null });
    },

    mapLayers: (pageId, update) => updateLayers(pageId, (layers) => layers.map(update)),

    addLayer(pageId, layer) {
      updateLayers(pageId, (layers) => [...layers, layer]);
      set({ selectedLayerId: layer.id, panelTab: 'style' });
    },

    addEraseArea: (pageId, area) =>
      updatePage(pageId, (page) => ({ ...page, manualEraseAreas: [...page.manualEraseAreas, area] })),

    removeEraseArea: (pageId, index) =>
      updatePage(pageId, (page) => ({
        ...page,
        manualEraseAreas: page.manualEraseAreas.filter((_, i) => i !== index),
      })),

    updateLayer: (pageId, layerId, patch) =>
      updateLayers(pageId, (layers) => layers.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer))),

    updateLayerStyle: (pageId, layerId, patch) =>
      updateLayers(pageId, (layers) =>
        layers.map((layer) => (layer.id === layerId ? { ...layer, style: { ...layer.style, ...patch } } : layer)),
      ),

    removeLayer(pageId, layerId) {
      updateLayers(pageId, (layers) => layers.filter((layer) => layer.id !== layerId));
      if (get().selectedLayerId === layerId) set({ selectedLayerId: null });
    },

    selectLayer: (layerId, options) =>
      set(layerId && options?.inspect ? { selectedLayerId: layerId, panelTab: 'style' } : { selectedLayerId: layerId }),

    setPanelTab: (panelTab) => set({ panelTab }),

    requestTextEdit: (layerId) =>
      set((state) => ({ selectedLayerId: layerId, panelTab: 'style', textEditRequest: state.textEditRequest + 1 })),

    setCleanedImage(pageId, image) {
      const page = get().pages.find((candidate) => candidate.id === pageId);
      if (!page) return;
      if (page.cleanedUrl) URL.revokeObjectURL(page.cleanedUrl);
      updatePage(pageId, (current) => ({
        ...current,
        cleaned: image,
        cleanedUrl: image && URL.createObjectURL(image),
      }));
      persist(image ? storage.saveImage(pageId, 'cleaned', image) : storage.deleteImage(pageId, 'cleaned'));
    },

    setPageTask: (pageId, task) =>
      set((state) => ({ pageTasks: { ...state.pageTasks, [pageId]: task ?? undefined } })),

    async clearProject() {
      get().pages.forEach(revokeUrls);
      set({ ...initialState, status: 'ready' });
      await storage.clearProject();
    },
  };
});

async function createPage(file: File): Promise<Page | null> {
  try {
    const { width, height } = await readImageSize(file);
    return {
      id: createId(),
      name: file.name,
      width,
      height,
      layers: [],
      manualEraseAreas: [],
      original: file,
      cleaned: null,
      originalUrl: URL.createObjectURL(file),
      cleanedUrl: null,
    };
  } catch {
    return null; // not an image the browser can decode
  }
}

function revokeUrls(page: Page): void {
  URL.revokeObjectURL(page.originalUrl);
  if (page.cleanedUrl) URL.revokeObjectURL(page.cleanedUrl);
}

/** Saving is best-effort: the editor keeps working if IndexedDB is unavailable. */
function persist(operation: Promise<unknown>): void {
  operation.catch((error: unknown) => console.warn('Could not save the project.', error));
}

const AUTOSAVE_DELAY_MS = 500;

function startAutosave(): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  useProjectStore.subscribe((state, previous) => {
    if (
      state.pages === previous.pages &&
      state.activePageId === previous.activePageId &&
      state.sourceLanguage === previous.sourceLanguage &&
      state.targetLanguage === previous.targetLanguage &&
      state.glossary === previous.glossary &&
      state.useBuiltInGlossary === previous.useBuiltInGlossary &&
      state.translationStyle === previous.translationStyle
    ) {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      const { pages, activePageId, sourceLanguage, targetLanguage, glossary, useBuiltInGlossary, translationStyle } =
        useProjectStore.getState();
      persist(
        storage.saveSnapshot({
          sourceLanguage,
          targetLanguage,
          glossary,
          useBuiltInGlossary,
          translationStyle,
          activePageId,
          pages: pages.map(({ id, name, width, height, layers, manualEraseAreas }) => ({
            id,
            name,
            width,
            height,
            layers,
            manualEraseAreas,
          })),
        }),
      );
    }, AUTOSAVE_DELAY_MS);
  });
}

export function useActivePage(): Page | null {
  return useProjectStore((state) => state.pages.find((page) => page.id === state.activePageId) ?? null);
}

export function useSelectedLayer(): TextLayer | null {
  return useProjectStore(
    (state) =>
      state.pages
        .find((page) => page.id === state.activePageId)
        ?.layers.find((layer) => layer.id === state.selectedLayerId) ?? null,
  );
}
