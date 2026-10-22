import { clear, createStore, del, delMany, get, getMany, set } from 'idb-keyval';
import type { GlossaryEntry } from './glossary';
import type { TranslationStyle } from './glossary/style';
import type { SourceLanguage, TargetLanguage } from './languages';
import type { Page } from './project';

// The project is kept in IndexedDB (localStorage is far too small for page images).
// Page images are stored once under their own keys; the rest is saved as one snapshot.

const store = createStore('manga-translate', 'project');
const SNAPSHOT_KEY = 'snapshot';
const SNAPSHOT_VERSION = 1;

type ImageKind = 'original' | 'cleaned';
type PageData = Pick<Page, 'id' | 'name' | 'width' | 'height' | 'layers' | 'manualEraseAreas'>;

export interface ProjectSnapshot {
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  activePageId: string | null;
  pages: PageData[];
  /** Missing in projects saved before the glossary existed. */
  glossary?: GlossaryEntry[];
  useBuiltInGlossary?: boolean;
  translationStyle?: TranslationStyle;
}

export interface SavedProject extends Omit<ProjectSnapshot, 'pages'> {
  pages: (PageData & { original: Blob; cleaned: Blob | null })[];
}

interface StoredSnapshot extends ProjectSnapshot {
  version: number;
}

const imageKey = (pageId: string, kind: ImageKind) => `image:${pageId}:${kind}`;

export async function loadProject(): Promise<SavedProject | null> {
  const snapshot = await get<StoredSnapshot>(SNAPSHOT_KEY, store);
  if (snapshot?.version !== SNAPSHOT_VERSION) return null;

  const pages = await Promise.all(
    snapshot.pages.map(async (page) => {
      const [original, cleaned] = await getMany<Blob | undefined>(
        [imageKey(page.id, 'original'), imageKey(page.id, 'cleaned')],
        store,
      );
      return original ? { ...page, original, cleaned: cleaned ?? null } : null;
    }),
  );
  return { ...snapshot, pages: pages.filter((page) => page !== null) };
}

export async function hasSavedProject(): Promise<boolean> {
  const snapshot = await get<StoredSnapshot>(SNAPSHOT_KEY, store);
  return Boolean(snapshot?.pages.length);
}

export function saveSnapshot(snapshot: ProjectSnapshot): Promise<void> {
  const stored: StoredSnapshot = { ...snapshot, version: SNAPSHOT_VERSION };
  return set(SNAPSHOT_KEY, stored, store);
}

export function saveImage(pageId: string, kind: ImageKind, image: Blob): Promise<void> {
  return set(imageKey(pageId, kind), image, store);
}

export function deleteImage(pageId: string, kind: ImageKind): Promise<void> {
  return del(imageKey(pageId, kind), store);
}

export function deletePageImages(pageId: string): Promise<void> {
  return delMany([imageKey(pageId, 'original'), imageKey(pageId, 'cleaned')], store);
}

export function clearProject(): Promise<void> {
  return clear(store);
}
