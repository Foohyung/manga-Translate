'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, Languages, Sparkles } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'หน้าแรก', icon: House },
  { href: '/worktable', label: 'โต๊ะทำงาน', icon: Languages },
];

/** `fluid` spans the full width (for the editor) instead of the centred content column. */
export function SiteHeader({ fluid = false }: { fluid?: boolean }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="h-0.5 bg-brand-gradient" />
      <nav className={`mx-auto flex h-14 items-center justify-between px-4 sm:px-6 ${fluid ? '' : 'max-w-7xl'}`}>
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-xl bg-brand-gradient shadow-lg shadow-primary/20 transition group-hover:shadow-primary/40">
            <Sparkles size={16} className="text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight">
            <span className="gradient-text">MangaTranslate</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition sm:px-4 ${
                  active ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-white/5 hover:text-foreground'
                }`}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
