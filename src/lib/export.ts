import { canvasToBlob, createCanvas, downloadBlob, fileBaseName, get2dContext } from './image';
import type { Page } from './project';
import { drawTextLayer, loadFonts } from './text-layout';

/** Draws the page (cleaned if available) with all its text layers at full resolution. */
export async function renderPage(page: Page): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(page.cleaned ?? page.original);
  const canvas = createCanvas(page.width, page.height);
  const context = get2dContext(canvas);
  context.drawImage(bitmap, 0, 0, page.width, page.height);
  bitmap.close();

  await loadFonts(page.layers.map((layer) => layer.style));
  page.layers.forEach((layer) => drawTextLayer(context, layer));
  return canvas;
}

export async function downloadPage(page: Page): Promise<void> {
  const image = await canvasToBlob(await renderPage(page));
  downloadBlob(image, `${fileBaseName(page.name)}-translated.png`);
}

export async function downloadPagesAsZip(
  pages: readonly Page[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (const [index, page] of pages.entries()) {
    const image = await canvasToBlob(await renderPage(page));
    // Numbered so pages keep their reading order when sorted by name.
    zip.file(`${String(index + 1).padStart(3, '0')}-${fileBaseName(page.name)}.png`, image);
    onProgress?.(index + 1, pages.length);
  }

  downloadBlob(await zip.generateAsync({ type: 'blob' }), 'manga-translate.zip');
}
