export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Box extends Point, Size {}

/** The outline text is fitted into: a rectangle, or the ellipse inscribed in the box. */
export type Shape = 'rect' | 'ellipse';

export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function unionBoxes(boxes: readonly Box[]): Box {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function expandBox(box: Box, dx: number, dy = dx): Box {
  return { x: box.x - dx, y: box.y - dy, width: box.width + dx * 2, height: box.height + dy * 2 };
}

/** Shrinks and shifts a box so it lies entirely within `bounds`. */
export function clampBox(box: Box, bounds: Size): Box {
  const width = Math.min(box.width, bounds.width);
  const height = Math.min(box.height, bounds.height);
  return {
    x: clamp(box.x, 0, bounds.width - width),
    y: clamp(box.y, 0, bounds.height - height),
    width,
    height,
  };
}

export function roundBox(box: Box): Box {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

export function moveBox(box: Box, dx: number, dy: number): Box {
  return { ...box, x: box.x + dx, y: box.y + dy };
}

function rotate(x: number, y: number, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/**
 * Resizes a box (rotated by `rotation` degrees around its centre) by dragging one of its
 * handles by (dx, dy) page pixels. The edges opposite the handle stay in place.
 */
export function resizeBox(
  start: Box,
  rotation: number,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  minSize: number,
): Box {
  const local = rotate(dx, dy, -rotation);
  let { width, height } = start;
  // How far the centre moves, in the box's own (unrotated) coordinates.
  let shiftX = 0;
  let shiftY = 0;

  if (handle.includes('e')) {
    const delta = Math.max(local.x, minSize - start.width);
    width += delta;
    shiftX = delta / 2;
  }
  if (handle.includes('w')) {
    const delta = Math.min(local.x, start.width - minSize);
    width -= delta;
    shiftX = delta / 2;
  }
  if (handle.includes('s')) {
    const delta = Math.max(local.y, minSize - start.height);
    height += delta;
    shiftY = delta / 2;
  }
  if (handle.includes('n')) {
    const delta = Math.min(local.y, start.height - minSize);
    height -= delta;
    shiftY = delta / 2;
  }

  const shift = rotate(shiftX, shiftY, rotation);
  const centerX = start.x + start.width / 2 + shift.x;
  const centerY = start.y + start.height / 2 + shift.y;
  return { x: centerX - width / 2, y: centerY - height / 2, width, height };
}
