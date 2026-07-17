import Tesseract from 'tesseract.js';

export interface TextBlock {
  id: string;
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
  translatedText?: string;
  rotation?: number;
}

export type OcrLanguage = 'auto' | 'jpn' | 'jpn_vert' | 'kor' | 'chi_sim' | 'chi_tra' | 'eng';

export const LANGUAGE_OPTIONS: { value: OcrLanguage; label: string; flag: string }[] = [
  { value: 'auto', label: 'ตรวจจับอัตโนมัติ (AI)', flag: '✨' },
  { value: 'jpn', label: 'ญี่ปุ่น (แนวนอน)', flag: '🇯🇵' },
  { value: 'jpn_vert', label: 'ญี่ปุ่น (แนวตั้ง・มังงะ)', flag: '🇯🇵' },
  { value: 'kor', label: 'เกาหลี', flag: '🇰🇷' },
  { value: 'chi_sim', label: 'จีน (ตัวย่อ)', flag: '🇨🇳' },
  { value: 'chi_tra', label: 'จีน (ตัวเต็ม)', flag: '🇹🇼' },
  { value: 'eng', label: 'อังกฤษ', flag: '🇺🇸' },
];

let workerInstance: Tesseract.Worker | null = null;
let currentLang: OcrLanguage | null = null;

export async function initOcrWorker(lang: OcrLanguage, onProgress?: (p: number) => void): Promise<void> {
  if (workerInstance && currentLang === lang) return;

  if (workerInstance) {
    await workerInstance.terminate();
  }

  workerInstance = await Tesseract.createWorker(lang, undefined, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(m.progress);
      }
    },
  });
  currentLang = lang;
}

async function getImageBlob(imageSource: string | HTMLCanvasElement): Promise<Blob> {
  if (typeof imageSource === 'string') {
    if (imageSource.startsWith('data:')) {
      const response = await fetch(imageSource);
      return await response.blob();
    }

    const response = await fetch(imageSource);
    return await response.blob();
  }

  return new Promise((resolve, reject) => {
    imageSource.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Unable to serialize canvas to blob'));
      }
    }, 'image/png');
  });
}

/**
 * Pre-process image for better OCR accuracy:
 * - Convert to grayscale
 * - Enhance contrast
 * - Sharpen edges
 */
function preprocessImageForOcr(imageSource: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Pass 1: Compute luminance stats for adaptive contrast
      let minL = 255;
      let maxL = 0;
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (lum < minL) minL = lum;
        if (lum > maxL) maxL = lum;
      }

      const range = maxL - minL || 1;

      // Pass 2: Apply grayscale + contrast stretch
      for (let i = 0; i < data.length; i += 4) {
        let lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Stretch contrast
        lum = ((lum - minL) / range) * 255;
        // Clamp
        lum = Math.max(0, Math.min(255, lum));

        data[i] = lum;
        data[i + 1] = lum;
        data[i + 2] = lum;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = imageSource;
  });
}

// Map OCR language to OCR.space language code
const OCR_SPACE_LANG_MAP: Record<string, string> = {
  'auto': 'jpn', // OCR.space doesn't have a good multi-lang auto, default to Japanese for manga
  'jpn': 'jpn',
  'jpn_vert': 'jpn',
  'kor': 'kor',
  'chi_sim': 'chs',
  'chi_tra': 'cht',
  'eng': 'eng',
};

async function detectTextWithOcrSpace(
  imageSource: string | HTMLCanvasElement,
  lang: OcrLanguage,
  onProgress?: (p: number) => void
): Promise<TextBlock[]> {
  if (onProgress) onProgress(0.1);

  const blob = await getImageBlob(imageSource);
  const ocrSpaceLang = OCR_SPACE_LANG_MAP[lang] || 'eng';

  /**
   * Helper: parse OCR.space response into TextBlock[] using Word-level bounding boxes.
   * Returns empty array if no valid bboxes found.
   */
  function parseOcrSpaceResponse(responseData: any): TextBlock[] {
    const parsedResult = responseData.ParsedResults?.[0];
    if (!parsedResult) return [];

    const overlayLines = parsedResult.TextOverlay?.Lines ?? [];
    const blocks: TextBlock[] = [];

    for (let lineIdx = 0; lineIdx < overlayLines.length; lineIdx++) {
      const line = overlayLines[lineIdx];
      const text = line.LineText?.trim();
      if (!text) continue;

      // Build bbox from Words array (most accurate)
      const words = line.Words ?? [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      let hasValidWord = false;

      for (const w of words) {
        const wl = w.Left ?? 0;
        const wt = w.Top ?? 0;
        const ww = w.Width ?? 0;
        const wh = w.Height ?? 0;
        // Only count as valid if the word has actual dimensions
        if (ww > 0 && wh > 0) {
          hasValidWord = true;
          if (wl < x0) x0 = wl;
          if (wt < y0) y0 = wt;
          if (wl + ww > x1) x1 = wl + ww;
          if (wt + wh > y1) y1 = wt + wh;
        }
      }

      // Fallback to line-level MinLeft/MinTop/MaxWidth/MaxHeight
      if (!hasValidWord) {
        const ml = line.MinLeft ?? -1;
        const mt = line.MinTop ?? -1;
        const mw = line.MaxWidth ?? 0;
        const mh = line.MaxHeight ?? 0;
        // Only use if it has real dimensions and is not at origin
        if (mw > 5 && mh > 5 && (ml > 0 || mt > 0)) {
          x0 = Math.max(0, ml);
          y0 = Math.max(0, mt);
          x1 = x0 + mw;
          y1 = y0 + mh;
          hasValidWord = true;
        }
      }

      // Calculate rotation if we have at least 2 words
      let rotation = 0;
      if (hasValidWord && words.length >= 2) {
        const firstWord = words[0];
        const lastWord = words[words.length - 1];
        if (firstWord.Left !== undefined && firstWord.Top !== undefined &&
            lastWord.Left !== undefined && lastWord.Top !== undefined &&
            lastWord.Left > firstWord.Left) {
          const dx = lastWord.Left - firstWord.Left;
          const dy = lastWord.Top - firstWord.Top;
          // Calculate angle in degrees
          rotation = Math.atan2(dy, dx) * (180 / Math.PI);
        }
      }

      blocks.push({
        id: `ocr-space-${lineIdx}-${Date.now()}`,
        text,
        bbox: { x0: Math.max(0, x0), y0: Math.max(0, y0), x1, y1 },
        confidence: 92,
        rotation,
      });
    }

    // Validation: if ALL blocks are clustered at the top-left corner, they're likely invalid
    if (blocks.length > 1) {
      const allAtOrigin = blocks.every(b => b.bbox.x0 < 5 && b.bbox.y0 < 5);
      if (allAtOrigin) {
        console.warn('All OCR bboxes at origin — likely invalid, discarding');
        return [];
      }
    }

    // Group blocks into paragraphs (speech bubbles) for better translation context
    const groupedBlocks: TextBlock[] = [];
    blocks.sort((a, b) => a.bbox.y0 - b.bbox.y0);

    for (const block of blocks) {
      const group = groupedBlocks.find((g) => {
        // Vertical distance: bottom of group to top of block
        const yDist = block.bbox.y0 - g.bbox.y1;
        // Must be close vertically (-20 to 60px)
        if (yDist < -20 || yDist > 60) return false;

        // Horizontal alignment: check if they overlap or centers are close
        // Manga speech bubbles usually have centered text, so x-centers should be very close
        const xCenterG = g.bbox.x0 + (g.bbox.x1 - g.bbox.x0) / 2;
        const xCenterB = block.bbox.x0 + (block.bbox.x1 - block.bbox.x0) / 2;
        const xDist = Math.abs(xCenterG - xCenterB);
        
        // They must either overlap horizontally by at least some amount, or their centers must be very close (e.g., within 40px)
        const overlap = Math.max(0, Math.min(g.bbox.x1, block.bbox.x1) - Math.max(g.bbox.x0, block.bbox.x0));
        return overlap > 0 || xDist < 40;
      });

      if (group) {
        group.text += ' ' + block.text;
        group.bbox.x0 = Math.min(group.bbox.x0, block.bbox.x0);
        group.bbox.y0 = Math.min(group.bbox.y0, block.bbox.y0);
        group.bbox.x1 = Math.max(group.bbox.x1, block.bbox.x1);
        group.bbox.y1 = Math.max(group.bbox.y1, block.bbox.y1);
        if (block.rotation) {
          group.rotation = group.rotation ? (group.rotation + block.rotation) / 2 : block.rotation;
        }
      } else {
        groupedBlocks.push(block);
      }
    }

    return groupedBlocks;
  }

  // ---- Strategy 1: Engine 1 (best overlay/bbox support) ----
  try {
    if (onProgress) onProgress(0.2);
    const formData1 = new FormData();
    formData1.append('apikey', 'helloworld');
    formData1.append('language', ocrSpaceLang);
    formData1.append('isOverlayRequired', 'true');
    formData1.append('OCREngine', '1');
    formData1.append('file', blob, 'page.png');

    const response1 = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData1,
    });

    if (response1.ok) {
      const data1 = await response1.json();
      const blocks1 = parseOcrSpaceResponse(data1);
      if (blocks1.length > 0) {
        console.log(`OCR.space Engine 1 (${ocrSpaceLang}): found ${blocks1.length} blocks with valid bboxes`);
        if (onProgress) onProgress(1);
        return blocks1;
      }
    }
  } catch (e) {
    console.warn('OCR.space Engine 1 failed:', e);
  }

  // ---- Strategy 2: Engine 2 (better text recognition, but bbox might be bad) ----
  try {
    if (onProgress) onProgress(0.5);
    const formData2 = new FormData();
    formData2.append('apikey', 'helloworld');
    formData2.append('language', ocrSpaceLang);
    formData2.append('isOverlayRequired', 'true');
    formData2.append('OCREngine', '2');
    formData2.append('file', blob, 'page.png');

    const response2 = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData2,
    });

    if (response2.ok) {
      const data2 = await response2.json();
      const blocks2 = parseOcrSpaceResponse(data2);
      if (blocks2.length > 0) {
        console.log(`OCR.space Engine 2 (${ocrSpaceLang}): found ${blocks2.length} blocks with valid bboxes`);
        if (onProgress) onProgress(1);
        return blocks2;
      }
    }
  } catch (e) {
    console.warn('OCR.space Engine 2 failed:', e);
  }

  throw new Error(`OCR.space found no text with valid bounding boxes (lang=${ocrSpaceLang})`);
}

async function detectTextWithTesseract(
  imageSource: string | HTMLCanvasElement,
  lang: OcrLanguage,
  onProgress?: (p: number) => void
): Promise<TextBlock[]> {
  if (onProgress) onProgress(0.1);

  // Pre-process the image for better accuracy
  let processedSource: string | HTMLCanvasElement = imageSource;
  if (typeof imageSource === 'string') {
    try {
      processedSource = await preprocessImageForOcr(imageSource);
      if (onProgress) onProgress(0.2);
    } catch {
      // If pre-processing fails, use original
      processedSource = imageSource;
    }
  }

  // Use the actual Tesseract language. jpn_vert is a valid Tesseract language data set.
  const tesseractLang = lang === 'auto' ? 'jpn+kor+eng' : lang;

  const result = await Tesseract.recognize(processedSource, tesseractLang, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(0.2 + m.progress * 0.8);
      }
    },
  });

  const words = (result.data as any).words as
    | Array<{
        text: string;
        bbox: { x0: number; y0: number; x1: number; y1: number };
        confidence: number;
      }>
    | undefined;

  if (words && words.length > 0) {
    // For CJK languages, use tighter vertical grouping
    const isCJK = ['auto', 'jpn', 'jpn_vert', 'kor', 'chi_sim', 'chi_tra'].includes(lang);
    const groupThreshold = isCJK ? 10 : 16;

    const groupedLines: Array<{
      text: string;
      bbox: { x0: number; y0: number; x1: number; y1: number };
      confidence: number;
      wordCount: number;
    }> = [];

    for (const word of words.filter((w) => w.text && w.text.trim().length > 0)) {
      const normalized = word.text.trim();
      const centerY = word.bbox.y0 + (word.bbox.y1 - word.bbox.y0) / 2;
      const line = groupedLines.find((item) => Math.abs(item.bbox.y0 + (item.bbox.y1 - item.bbox.y0) / 2 - centerY) < groupThreshold);

      if (line) {
        // For CJK, don't add space between characters
        line.text = isCJK ? `${line.text}${normalized}` : `${line.text} ${normalized}`.trim();
        line.bbox.x0 = Math.min(line.bbox.x0, word.bbox.x0);
        line.bbox.y0 = Math.min(line.bbox.y0, word.bbox.y0);
        line.bbox.x1 = Math.max(line.bbox.x1, word.bbox.x1);
        line.bbox.y1 = Math.max(line.bbox.y1, word.bbox.y1);
        line.confidence += (word.confidence ?? 0);
        line.wordCount += 1;
      } else {
        groupedLines.push({
          text: normalized,
          bbox: {
            x0: word.bbox.x0,
            y0: word.bbox.y0,
            x1: word.bbox.x1,
            y1: word.bbox.y1,
          },
          confidence: word.confidence ?? 0,
          wordCount: 1,
        });
      }
    }

    if (onProgress) onProgress(1);
    return groupedLines
      .filter((line) => line.text.trim().length > 0)
      .map((line, idx) => ({
        id: `tesseract-line-${idx}-${Date.now()}`,
        text: line.text,
        bbox: line.bbox,
        confidence: Math.round(line.confidence / Math.max(1, line.wordCount)),
      }));
  }

  const lines = (result.data as any).lines as
    | Array<{
        text: string;
        bbox: { x0: number; y0: number; x1: number; y1: number };
        confidence: number;
      }>
    | undefined;

  const safeLines = lines ?? [];
  const parsed = safeLines
    .filter((line) => line.text && line.text.trim().length > 0)
    .map((line, idx) => ({
      id: `tesseract-line-${idx}-${Date.now()}`,
      text: line.text.trim(),
      bbox: {
        x0: line.bbox.x0,
        y0: line.bbox.y0,
        x1: line.bbox.x1,
        y1: line.bbox.y1,
      },
      confidence: line.confidence ?? 0,
    }));

  if (onProgress) onProgress(1);
  return parsed;
}

/**
 * For 'auto' mode, try OCR.space with multiple languages in order.
 * OCR.space is fast and doesn't need heavy downloads like Tesseract multi-lang packs.
 * We try eng → jpn → kor → chi_sim in sequence until we get results with bounding boxes.
 */
async function detectTextAutoWithOcrSpace(
  imageSource: string | HTMLCanvasElement,
  onProgress?: (p: number) => void
): Promise<TextBlock[]> {
  const langsToTry: OcrLanguage[] = ['eng', 'jpn', 'kor', 'chi_sim'];

  for (let i = 0; i < langsToTry.length; i++) {
    const lang = langsToTry[i];
    if (onProgress) onProgress((i / langsToTry.length) * 0.5);
    try {
      const blocks = await detectTextWithOcrSpace(imageSource, lang, (p) => {
        if (onProgress) onProgress((i / langsToTry.length) * 0.5 + p * (0.5 / langsToTry.length));
      });
      if (blocks.length > 0) {
        console.log(`Auto-detect: OCR.space found ${blocks.length} blocks with lang=${lang}`);
        if (onProgress) onProgress(1);
        return blocks;
      }
    } catch {
      // This lang didn't work, try next
      continue;
    }
  }

  throw new Error('Auto-detect: OCR.space found no text with any language');
}

export async function detectText(
  imageSource: string | HTMLCanvasElement,
  lang: OcrLanguage,
  onProgress?: (p: number) => void
): Promise<TextBlock[]> {
  if (lang === 'auto') {
    // Strategy 1: Try OCR.space with multiple languages (fast, no downloads)
    try {
      return await detectTextAutoWithOcrSpace(imageSource, onProgress);
    } catch (error) {
      console.warn('Auto OCR.space failed, trying Tesseract with eng', error);
    }
    // Strategy 2: Fall back to Tesseract with English only (lighter than multi-lang)
    try {
      return await detectTextWithTesseract(imageSource, 'eng', onProgress);
    } catch (error) {
      console.warn('Tesseract eng failed, trying jpn', error);
    }
    // Strategy 3: Try Tesseract with Japanese
    return await detectTextWithTesseract(imageSource, 'jpn', onProgress);
  }

  // Non-auto: Use OCR.space first, fall back to Tesseract
  try {
    return await detectTextWithOcrSpace(imageSource, lang, onProgress);
  } catch (error) {
    console.warn('OCR.space failed, trying Tesseract', error);
    return await detectTextWithTesseract(imageSource, lang, onProgress);
  }
}

export async function terminateOcr(): Promise<void> {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
    currentLang = null;
  }
}

