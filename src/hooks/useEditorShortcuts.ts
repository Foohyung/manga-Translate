import { useEffect } from 'react';
import { moveBox } from '@/lib/geometry';
import { duplicateLayer } from '@/lib/project';
import { useProjectStore } from '@/store/project-store';

const ARROW_DIRECTIONS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/**
 * Shortcuts for the selected text layer: arrows nudge it (Shift = 10px), Delete removes it,
 * Ctrl/⌘+D duplicates it and Escape deselects it.
 */
export function useEditorShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;

      const { pages, activePageId, selectedLayerId, selectLayer, removeLayer, addLayer, updateLayer } =
        useProjectStore.getState();
      const page = pages.find((candidate) => candidate.id === activePageId);
      const layer = page?.layers.find((candidate) => candidate.id === selectedLayerId);
      if (!page || !layer) return;

      const direction = ARROW_DIRECTIONS[event.key];
      if (direction) {
        const step = event.shiftKey ? 10 : 1;
        updateLayer(page.id, layer.id, { box: moveBox(layer.box, direction[0] * step, direction[1] * step) });
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        removeLayer(page.id, layer.id);
      } else if (event.key === 'Escape') {
        selectLayer(null);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        addLayer(page.id, duplicateLayer(layer));
      } else {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
