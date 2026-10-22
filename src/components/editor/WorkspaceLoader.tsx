'use client';

import dynamic from 'next/dynamic';
import { Spinner } from '@/components/ui/Spinner';

// The editor depends on browser-only APIs (IndexedDB, canvas, object URLs), so it is never
// rendered on the server.
export const WorkspaceLoader = dynamic(() => import('./Workspace').then((module) => module.Workspace), {
  ssr: false,
  loading: Spinner,
});
