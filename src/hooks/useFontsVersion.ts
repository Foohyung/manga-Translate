import { useSyncExternalStore } from 'react';

// Text is measured on a canvas, which uses fallback metrics until a web font finishes
// loading. Components that measure text subscribe here to re-measure afterwards.

let version = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) document.fonts.addEventListener('loadingdone', notify);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) document.fonts.removeEventListener('loadingdone', notify);
  };
}

function notify(): void {
  version++;
  listeners.forEach((listener) => listener());
}

/** Changes whenever more web fonts have finished loading. */
export function useFontsVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  );
}
