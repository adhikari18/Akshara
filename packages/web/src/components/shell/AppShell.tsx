'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';

export type Role = 'student' | 'parent' | 'admin';

export interface NavItem {
  href: string;
  emoji: string;
  label: string;
  /** Short Nepali label shown above the English one. */
  ne?: string;
}

const ROLE_STYLE: Record<Role, { badge: string; title: string; accent: string }> = {
  student: {
    badge: 'bg-amber-400 text-slate-900',
    title: 'विद्यार्थी • Student',
    accent: 'border-amber-400 bg-amber-100 dark:bg-amber-400/15',
  },
  parent: {
    badge: 'bg-sky-500 text-white',
    title: 'अभिभावक • Parent',
    accent: 'border-sky-400 bg-sky-100 dark:bg-sky-400/15',
  },
  admin: {
    badge: 'bg-slate-700 text-white',
    title: 'प्रशासक • Admin',
    accent: 'border-slate-500 bg-slate-200 dark:bg-slate-500/20',
  },
};

/** Normalise "/student/trace/" and "/student/trace" (and a basePath prefix) for matching. */
function sameRoute(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  const clean = (p: string) => p.replace(/\/+$/, '') || '/';
  const path = clean(pathname);
  const target = clean(href);
  return path === target || path.endsWith(target);
}

interface AppShellProps {
  role: Role;
  nav: NavItem[];
  /** Extra controls on the right of the header (child chip, font picker, …). */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Layout shared by the three experiences — Student, Parent and Admin — each with its own colour,
 * navigation and header controls. The logo always leads back to the role chooser.
 */
export function AppShell({ role, nav, actions, children }: AppShellProps) {
  const pathname = usePathname();
  const style = ROLE_STYLE[role];
  return (
    <div className="min-h-screen flex flex-col" data-role={role}>
      <header className="lg:sticky top-0 z-30 border-b border-line bg-page/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              aria-label="Akshara home — choose who is using the app"
              className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl font-black text-white shadow-[0_4px_0_rgb(194_65_12)] -rotate-3"
            >
              अ
            </Link>
            <div className="min-w-0">
              <p className="text-lg sm:text-xl font-black tracking-tight text-ink leading-tight">
                Akshara <span className="text-amber-500">अक्षर</span>
              </p>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${style.badge}`}
              >
                {style.title}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions}
            <ThemeToggle />
          </div>
        </div>
        <nav aria-label={`${role} navigation`} className="max-w-7xl mx-auto px-4 sm:px-6 pb-2">
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {nav.map((item) => {
              const active = sameRoute(pathname, item.href);
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 text-sm font-bold transition ${
                      active
                        ? `${style.accent} text-ink`
                        : 'border-line bg-card text-ink-soft hover:text-ink'
                    }`}
                  >
                    <span aria-hidden className="text-lg">
                      {item.emoji}
                    </span>
                    <span className="leading-tight">
                      {item.ne && <span className="block text-xs">{item.ne}</span>}
                      <span className="block">{item.label}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        {children}
      </main>
      <footer className="py-6 text-center text-xs text-ink-faint">
        Akshara • MIT Open Source • Made with ❤️ for young learners
      </footer>
    </div>
  );
}

/** The app's URL for `path`, including the GitHub Pages base path (for plain anchors / redirects). */
export function appHref(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
