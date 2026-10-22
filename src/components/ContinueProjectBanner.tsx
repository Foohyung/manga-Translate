'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';
import { hasSavedProject } from '@/lib/storage';

/** Offers to reopen the project saved in this browser, if there is one. */
export function ContinueProjectBanner() {
  const [hasProject, setHasProject] = useState(false);

  useEffect(() => {
    hasSavedProject().then(setHasProject, () => setHasProject(false));
  }, []);

  if (!hasProject) return null;

  return (
    <section className="px-4 pb-6 sm:px-6">
      <div className="glass-card mx-auto flex max-w-7xl flex-col gap-4 rounded-3xl p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <FileText size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold text-primary">มีงานที่ทำค้างไว้</p>
            <p className="text-lg font-bold">กลับไปทำต่อจากเดิมได้ทันที</p>
            <p className="text-sm text-muted">ภาพ ข้อความ และการจัดวางถูกบันทึกไว้ในเบราว์เซอร์นี้</p>
          </div>
        </div>
        <Link
          href="/worktable"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-5 py-3 text-sm font-semibold transition hover:bg-white/5"
        >
          ทำต่อ <ArrowRight size={16} className="text-primary" />
        </Link>
      </div>
    </section>
  );
}
