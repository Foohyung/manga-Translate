import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { WorkspaceLoader } from '@/components/editor/WorkspaceLoader';

export const metadata: Metadata = {
  title: 'โต๊ะทำงานแปล',
};

export default function WorktablePage() {
  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader fluid />
      <WorkspaceLoader />
    </div>
  );
}
