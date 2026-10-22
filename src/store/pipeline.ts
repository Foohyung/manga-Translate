import { requestTranslations } from '@/lib/api';
import { completeEntries } from '@/lib/glossary';
import { eraseText } from '@/lib/inpaint';
import { extractText, type OcrEngine } from '@/lib/ocr/extract-text';
import type { EraseArea } from '@/lib/inpaint';
import { areasToErase, createLayerFromOcr, type Page } from '@/lib/project';
import { fitFontSize } from '@/lib/text-layout';
import { useProjectStore, type PageTask } from './project-store';

// The long-running steps of translating a page. Each reads the latest state after awaiting,
// because the user can keep editing (or delete the page) while it runs.

function findPage(pageId: string): Page | undefined {
  return useProjectStore.getState().pages.find((page) => page.id === pageId);
}

async function runTask<T>(pageId: string, task: PageTask, work: (page: Page) => Promise<T>): Promise<T> {
  const page = findPage(pageId);
  if (!page) throw new Error('ไม่พบหน้านี้แล้ว');
  const { setPageTask } = useProjectStore.getState();
  setPageTask(pageId, task);
  try {
    return await work(page);
  } finally {
    setPageTask(pageId, null);
  }
}

/** Reads the text on a page and replaces its layers with one layer per block found. */
export function extractPageText(pageId: string): Promise<{ blocks: number; engine: OcrEngine }> {
  return runTask(pageId, 'extract', async (page) => {
    const { blocks, engine } = await extractText(page.original, useProjectStore.getState().sourceLanguage);
    useProjectStore.getState().setLayers(
      pageId,
      blocks.map((block) => createLayerFromOcr(block, page)),
    );
    return { blocks: blocks.length, engine };
  });
}

/**
 * Translates the source text of a page's layers (or only `layerIds`). The font size
 * shrinks where needed so the translation fits its box.
 */
export function translatePage(
  pageId: string,
  layerIds?: readonly string[],
): Promise<{ translated: number; failed: number }> {
  return runTask(pageId, 'translate', async (page) => {
    const layers = page.layers.filter(
      (layer) => layer.sourceText.trim() && (!layerIds || layerIds.includes(layer.id)),
    );
    if (layers.length === 0) return { translated: 0, failed: 0 };

    const { sourceLanguage, targetLanguage, glossary, useBuiltInGlossary, translationStyle } = useProjectStore.getState();
    const translations = await requestTranslations(
      layers.map((layer) => layer.sourceText),
      sourceLanguage,
      targetLanguage,
      { glossary: completeEntries(glossary), useBuiltInGlossary, style: translationStyle },
    );
    const translationById = new Map(layers.map((layer, index) => [layer.id, translations[index]]));

    useProjectStore.getState().mapLayers(pageId, (layer) => {
      const text = translationById.get(layer.id);
      if (text == null) return layer;
      const fontSize = fitFontSize(text, layer.style, layer.box, layer.shape, layer.style.fontSize);
      return { ...layer, text, style: { ...layer.style, fontSize } };
    });

    const failed = translations.filter((text) => text === null).length;
    return { translated: layers.length - failed, failed };
  });
}

/** The erase areas each page's cleaned image was last made from. */
const cleanedFrom = new Map<string, string>();
const areasKey = (areas: readonly EraseArea[]) => JSON.stringify(areas);

/**
 * Erases the original text in the chosen text boxes (every detected box, unless the user
 * deselected some) and in the areas drawn by hand, and returns how many areas were erased.
 * With none, the page goes back to its original image.
 */
export function cleanPage(pageId: string): Promise<number> {
  return runTask(pageId, 'clean', async (page) => {
    const areas = areasToErase(page);
    const cleaned = areas.length > 0 ? await eraseText(page.original, areas) : null;
    useProjectStore.getState().setCleanedImage(pageId, cleaned);
    cleanedFrom.set(pageId, areasKey(areas));
    return areas.length;
  });
}

const CLEAN_DELAY_MS = 300;
const cleanTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Cleans a page shortly, unless its image already matches its erase areas. Quick successive
 * requests — clicking through several boxes — run as one clean.
 */
export function scheduleClean(pageId: string, onError: (error: unknown) => void): void {
  clearTimeout(cleanTimers.get(pageId));
  cleanTimers.set(
    pageId,
    setTimeout(() => {
      cleanTimers.delete(pageId);
      const { pages, pageTasks } = useProjectStore.getState();
      const page = pages.find((candidate) => candidate.id === pageId);
      if (!page) return;
      if (pageTasks[pageId]) {
        scheduleClean(pageId, onError); // busy: try again once it is done
        return;
      }
      const areas = areasToErase(page);
      const upToDate = cleanedFrom.get(pageId) === areasKey(areas) && Boolean(page.cleaned) === areas.length > 0;
      if (!upToDate) cleanPage(pageId).catch(onError);
    }, CLEAN_DELAY_MS),
  );
}

/**
 * Keeps cleaned pages matching their erase areas: when a box is deselected, drawn, removed or
 * re-detected, the page is cleaned again from its original. Pages that were never cleaned are
 * left for the user to clean. Returns an unsubscribe function.
 */
export function keepCleanedPagesInSync(onError: (error: unknown) => void): () => void {
  return useProjectStore.subscribe((state, previous) => {
    if (state.pages === previous.pages) return;
    for (const page of state.pages) {
      const before = previous.pages.find((candidate) => candidate.id === page.id);
      if (!page.cleaned || !before) continue;
      if (before.layers === page.layers && before.manualEraseAreas === page.manualEraseAreas) continue;
      const known = cleanedFrom.get(page.id) ?? areasKey(areasToErase(before));
      if (known !== areasKey(areasToErase(page))) scheduleClean(page.id, onError);
    }
  });
}

/** Extract → clean → translate, page by page. */
export async function translatePagesAutomatically(
  pageIds: readonly string[],
  onProgress: (done: number, total: number) => void,
): Promise<{ failedPages: number; pagesWithoutText: number }> {
  let failedPages = 0;
  let pagesWithoutText = 0;
  for (const [index, pageId] of pageIds.entries()) {
    try {
      const { blocks } = await extractPageText(pageId);
      if (blocks === 0) {
        pagesWithoutText++;
      } else {
        await cleanPage(pageId);
        const { failed } = await translatePage(pageId);
        if (failed > 0) failedPages++;
      }
    } catch (error) {
      console.error(`Automatic translation failed for page ${pageId}.`, error);
      failedPages++;
    }
    onProgress(index + 1, pageIds.length);
  }
  return { failedPages, pagesWithoutText };
}
