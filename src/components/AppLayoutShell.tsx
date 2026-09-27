'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import seloraxLogo from '@/assets/SeloraX logo.png';
import seloraxLogoDark from '@/assets/SeloraX-logo-dark.png';
import { ThemeToggle } from '@/components/ThemeProvider';
import { Lock } from 'lucide-react';

export default function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) {
    return (
      <div className="relative min-h-dvh w-full flex flex-col bg-slate-50 dark:bg-[#090B0E] text-zinc-900 dark:text-zinc-100 selection:bg-orange-500/20 selection:text-orange-500 transition-colors duration-200">
        {/* Subtle engineering dot pattern across the entire viewport */}
        <div className="pointer-events-none fixed inset-0 bg-grid-dots opacity-70 [mask-image:radial-gradient(ellipse_85%_75%_at_50%_0%,#000_60%,transparent_100%)] z-0" />
        <div className="relative z-10 w-full flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh md:h-dvh flex flex-col justify-between items-center selection:bg-orange-500/20 selection:text-orange-500">
      {/* Engineering micro-dot background with radial gradient mask */}
      <div className="pointer-events-none fixed inset-0 bg-grid-dots opacity-70 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_0%,#000_50%,transparent_100%)] z-0" />

      {/* Compact Navigation Bar / Top Bar */}
      <header className="relative z-10 w-full max-w-4xl px-4 py-2 sm:py-3 shrink-0 flex items-center justify-between">
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-xl px-1 py-0.5 transition-all hover:opacity-95"
        >
          <div className="relative flex items-center justify-center rounded-xl bg-white/90 dark:bg-zinc-900/80 px-2.5 py-1 border border-zinc-200/90 dark:border-zinc-800/90 shadow-2xs backdrop-blur-md transition-all group-hover:border-zinc-300 dark:group-hover:border-zinc-700">
            {/* Light Mode Logo: Navy Blue Selora + Orange X */}
            <Image
              src={seloraxLogo}
              alt="SeloraX Logo"
              height={22}
              width={88}
              priority
              className="h-5 sm:h-5.5 w-auto object-contain block dark:hidden"
            />
            {/* Night / Dark Mode Logo: Crisp White Selora + Fiery Orange X */}
            <Image
              src={seloraxLogoDark}
              alt="SeloraX Logo"
              height={22}
              width={88}
              priority
              className="h-5 sm:h-5.5 w-auto object-contain hidden dark:block"
            />
          </div>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/"
            className="flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-white/80 px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-2xs backdrop-blur-md transition-all hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            Directory
          </Link>

          <a
            href="https://selorax.io"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-white/80 px-2.5 py-1 text-xs font-semibold text-zinc-700 shadow-2xs backdrop-blur-md transition-all hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            selorax.io ↗
          </a>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-4xl px-3 sm:px-4 py-1 sm:py-2 flex-1 flex flex-col items-center justify-center min-h-0">
        {children}
      </main>

      {/* Ultra-compact global footer */}
      <footer className="relative z-10 w-full py-1.5 sm:py-2 shrink-0 text-center text-[10px] text-zinc-400 dark:text-zinc-600 font-mono-numbers flex items-center justify-center gap-1.5">
        <span>SeloraX Team Directory • SX-EMS v2.4</span>
        <Link
          href="/admin"
          title="Admin Console"
          className="opacity-40 hover:opacity-100 transition p-0.5 text-zinc-400 hover:text-orange-500"
        >
          <Lock className="h-2.5 w-2.5 inline" />
        </Link>
      </footer>
    </div>
  );
}
