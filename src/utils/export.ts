import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Export a single canvas as PNG
 */
export function exportCanvasAsPng(canvas: HTMLCanvasElement, filename: string = 'translated.png'): void {
  canvas.toBlob((blob) => {
    if (blob) {
      saveAs(blob, filename);
    }
  }, 'image/png');
}

/**
 * Export multiple canvases as a ZIP file
 */
export async function exportAsZip(
  canvases: HTMLCanvasElement[],
  projectName: string = 'translated_manga'
): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(projectName);

  if (!folder) throw new Error('Failed to create ZIP folder');

  for (let i = 0; i < canvases.length; i++) {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvases[i].toBlob(resolve, 'image/png');
    });

    if (blob) {
      const paddedIndex = String(i + 1).padStart(3, '0');
      folder.file(`page_${paddedIndex}.png`, blob);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `${projectName}.zip`);
}

/**
 * Render text overlays onto a canvas and return the final result
 */
export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  maxWidth?: number;
  lineHeight?: number;
  strokeColor?: string;
  strokeWidth?: number;
  rotation?: number;
}

export function renderTextOverlays(
  baseCanvas: HTMLCanvasElement,
  overlays: TextOverlay[]
): HTMLCanvasElement {
  const result = document.createElement('canvas');
  result.width = baseCanvas.width;
  result.height = baseCanvas.height;
  const ctx = result.getContext('2d')!;

  // Draw base image
  ctx.drawImage(baseCanvas, 0, 0);

  // Draw text overlays
  for (const overlay of overlays) {
    const fontStyle = `${overlay.italic ? 'italic' : ''} ${overlay.bold ? 'bold' : ''} ${overlay.fontSize}px "${overlay.fontFamily}"`.trim();
    ctx.font = fontStyle;
    ctx.textBaseline = 'top';

    const maxWidth = overlay.maxWidth || result.width - overlay.x;
    const lineHeight = overlay.lineHeight || overlay.fontSize * 1.3;
    const words = overlay.text.split('');
    const lines: string[] = [];
    let currentLine = '';

    // Word wrap for CJK (character-based wrapping)
    for (const char of words) {
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    ctx.save();
    if (overlay.rotation) {
      ctx.translate(overlay.x, overlay.y);
      ctx.rotate((overlay.rotation * Math.PI) / 180);
      ctx.translate(-overlay.x, -overlay.y);
    }

    // Draw each line
    lines.forEach((line, idx) => {
      const y = overlay.y + idx * lineHeight;

      // Stroke (outline)
      if (overlay.strokeColor && overlay.strokeWidth) {
        ctx.strokeStyle = overlay.strokeColor;
        ctx.lineWidth = overlay.strokeWidth;
        ctx.lineJoin = 'round';
        ctx.strokeText(line, overlay.x, y);
      }

      // Fill
      ctx.fillStyle = overlay.color;
      ctx.fillText(line, overlay.x, y);
    });
    
    ctx.restore();
  }

  return result;
}
