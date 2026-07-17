/**
 * Canvas-based inpainting using Edge Dominant Color Fill.
 *
 * Instead of a naive neighbor blur (which produces blotchy artifacts),
 * this approach:
 * 1. Samples the border region around each masked area to find
 *    the dominant background color.
 * 2. Fills the masked region with that dominant color.
 * 3. Applies a multi-pass Gaussian-like blur at the edges
 *    for a smooth transition.
 *
 * This works very well for speech bubbles and clean backgrounds
 * commonly found in manga/manhwa.
 */

export function inpaintCanvas(
  sourceCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement
): HTMLCanvasElement {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const resultCtx = resultCanvas.getContext('2d')!;

  const sourceCtx = sourceCanvas.getContext('2d')!;
  const maskCtx = maskCanvas.getContext('2d')!;

  const sourceData = sourceCtx.getImageData(0, 0, width, height);
  const maskData = maskCtx.getImageData(0, 0, width, height);
  const resultData = new ImageData(
    new Uint8ClampedArray(sourceData.data),
    width,
    height
  );

  const isMasked = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const idx = (y * width + x) * 4;
    // We draw white (255,255,255) on black (0,0,0) background for the mask.
    // Check the red channel. Ignore alpha, because the black background has alpha=255.
    return maskData.data[idx] > 128;
  };

  // ---- Step 1: Find connected masked regions and fill with dominant edge color ----

  // Build a visited map for flood-fill region detection
  const visited = new Uint8Array(width * height);

  // Directions for BFS
  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];

  for (let startY = 0; startY < height; startY++) {
    for (let startX = 0; startX < width; startX++) {
      if (!isMasked(startX, startY) || visited[startY * width + startX]) continue;

      // BFS to find this connected masked region
      const region: [number, number][] = [];
      const borderPixels: [number, number][] = [];
      const queue: [number, number][] = [[startX, startY]];
      visited[startY * width + startX] = 1;

      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        region.push([cx, cy]);

        for (let d = 0; d < 4; d++) {
          const nx = cx + dx[d];
          const ny = cy + dy[d];
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nKey = ny * width + nx;
          if (visited[nKey]) continue;

          if (isMasked(nx, ny)) {
            visited[nKey] = 1;
            queue.push([nx, ny]);
          }
        }
      }

      // Collect border pixels (non-masked pixels adjacent to the region)
      // Use a wider sampling band (up to 6px outside) for a more reliable color estimate
      const regionSet = new Set(region.map(([x, y]) => y * width + x));
      const borderSet = new Set<number>();

      for (const [rx, ry] of region) {
        for (let band = 1; band <= 6; band++) {
          for (let d = 0; d < 4; d++) {
            const bx = rx + dx[d] * band;
            const by = ry + dy[d] * band;
            if (bx < 0 || by < 0 || bx >= width || by >= height) continue;
            const bKey = by * width + bx;
            if (!regionSet.has(bKey) && !borderSet.has(bKey)) {
              borderSet.add(bKey);
              borderPixels.push([bx, by]);
            }
          }
        }
      }

      // Calculate the dominant color from border pixels
      let dr = 0, dg = 0, db = 0;
      let sampleCount = 0;

      if (borderPixels.length > 0) {
        // Use median approach via histogram for robustness
        const rValues: number[] = [];
        const gValues: number[] = [];
        const bValues: number[] = [];

        for (const [bx, by] of borderPixels) {
          const idx = (by * width + bx) * 4;
          rValues.push(sourceData.data[idx]);
          gValues.push(sourceData.data[idx + 1]);
          bValues.push(sourceData.data[idx + 2]);
        }

        // Sort to find the true background color, ignoring text remnants
        rValues.sort((a, b) => a - b);
        gValues.sort((a, b) => a - b);
        bValues.sort((a, b) => a - b);

        // Determine if background is light or dark by checking the median brightness
        const mid = Math.floor(rValues.length / 2);
        const medianBright = 0.299 * rValues[mid] + 0.587 * gValues[mid] + 0.114 * bValues[mid];

        // If light background, pick 90th percentile (purest white). If dark, pick 10th percentile (purest black)
        const targetIdx = medianBright > 127
          ? Math.floor(rValues.length * 0.90)
          : Math.floor(rValues.length * 0.10);

        dr = rValues[targetIdx];
        dg = gValues[targetIdx];
        db = bValues[targetIdx];
        sampleCount = borderPixels.length;
      }

      // Fill the region with the dominant color
      if (sampleCount > 0) {
        for (const [rx, ry] of region) {
          const idx = (ry * width + rx) * 4;
          resultData.data[idx] = dr;
          resultData.data[idx + 1] = dg;
          resultData.data[idx + 2] = db;
          resultData.data[idx + 3] = 255;
        }
      } else {
        // Fallback: if no border pixels found, use the original pixel
        for (const [rx, ry] of region) {
          const idx = (ry * width + rx) * 4;
          resultData.data[idx] = sourceData.data[idx];
          resultData.data[idx + 1] = sourceData.data[idx + 1];
          resultData.data[idx + 2] = sourceData.data[idx + 2];
          resultData.data[idx + 3] = sourceData.data[idx + 3];
        }
      }
    }
  }

  // ---- Step 2: Smooth the edges of masked regions for a natural transition ----
  // Apply a small blur kernel at the boundary between masked and non-masked pixels

  const edgePixels: [number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isMasked(x, y)) continue;
      // Check if this pixel is at the edge of the mask
      let isEdge = false;
      for (let d = 0; d < 4; d++) {
        const nx = x + dx[d];
        const ny = y + dy[d];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || !isMasked(nx, ny)) {
          isEdge = true;
          break;
        }
      }
      if (isEdge) edgePixels.push([x, y]);
    }
  }

  // Multi-pass edge smoothing (3 passes with expanding radius)
  const smoothData = new Uint8ClampedArray(resultData.data);

  for (let pass = 0; pass < 3; pass++) {
    const radius = pass + 1;
    for (const [ex, ey] of edgePixels) {
      let r = 0, g = 0, b = 0, count = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const nx = ex + kx;
          const ny = ey + ky;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nIdx = (ny * width + nx) * 4;
          // Weight: closer pixels matter more
          const weight = 1 / (Math.abs(kx) + Math.abs(ky) + 1);
          r += resultData.data[nIdx] * weight;
          g += resultData.data[nIdx + 1] * weight;
          b += resultData.data[nIdx + 2] * weight;
          count += weight;
        }
      }

      if (count > 0) {
        const idx = (ey * width + ex) * 4;
        smoothData[idx] = Math.round(r / count);
        smoothData[idx + 1] = Math.round(g / count);
        smoothData[idx + 2] = Math.round(b / count);
        smoothData[idx + 3] = 255;
      }
    }

    // Copy smooth data back for next pass
    for (const [ex, ey] of edgePixels) {
      const idx = (ey * width + ex) * 4;
      resultData.data[idx] = smoothData[idx];
      resultData.data[idx + 1] = smoothData[idx + 1];
      resultData.data[idx + 2] = smoothData[idx + 2];
      resultData.data[idx + 3] = smoothData[idx + 3];
    }
  }

  resultCtx.putImageData(resultData, 0, 0);
  return resultCanvas;
}

/**
 * Auto-generate a mask from OCR bounding boxes
 */
export function generateMaskFromBoxes(
  sourceCanvas: HTMLCanvasElement,
  boxes: { x0: number; y0: number; x1: number; y1: number }[],
  padding: number = 6
): HTMLCanvasElement {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const ctx = maskCanvas.getContext('2d')!;

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  const sourceCtx = sourceCanvas.getContext('2d')!;
  const sourceData = sourceCtx.getImageData(0, 0, width, height).data;

  const maskData = ctx.getImageData(0, 0, width, height);
  const data = maskData.data;

  for (const box of boxes) {
    const startX = Math.max(0, Math.floor(box.x0 - padding));
    const startY = Math.max(0, Math.floor(box.y0 - padding));
    const endX = Math.min(width, Math.ceil(box.x1 + padding));
    const endY = Math.min(height, Math.ceil(box.y1 + padding));

    // Usually manga text is black on white bubble (or white on black).
    let totalBright = 0;
    let count = 0;
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4;
        totalBright += 0.299 * sourceData[idx] + 0.587 * sourceData[idx + 1] + 0.114 * sourceData[idx + 2];
        count++;
      }
    }
    const avgBright = count > 0 ? totalBright / count : 255;
    const isDarkText = avgBright > 127;
    const threshold = 127; // Strict threshold for manga (which is mostly B&W)

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const idx = (y * width + x) * 4;
        const brightness = 0.299 * sourceData[idx] + 0.587 * sourceData[idx + 1] + 0.114 * sourceData[idx + 2];

        let isText = false;
        if (isDarkText && brightness < threshold) isText = true;
        if (!isDarkText && brightness > threshold) isText = true;

        if (isText) {
          // Dilate the mask by 1 pixel (3x3 grid) to catch anti-aliased edges without exploding into a block
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                const nIdx = (ny * width + nx) * 4;
                data[nIdx] = 255;
                data[nIdx + 1] = 255;
                data[nIdx + 2] = 255;
              }
            }
          }
        }
      }
    }
  }

  ctx.putImageData(maskData, 0, 0);
  return maskCanvas;
}
