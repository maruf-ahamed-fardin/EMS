import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import seloraxLogo from '@/assets/SeloraX logo.png';
import { ThemeProvider, ThemeToggle } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/Toast';
import './globals.css';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'SeloraX Directory & Profiles', template: '%s | SeloraX Team' },
  description: 'Precision engineering directory & digital identity for SeloraX team members.',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#090b0e',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const storedTheme = localStorage.getItem('selorax-theme');
                if (storedTheme === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-dvh h-dvh max-h-dvh overflow-x-hidden overflow-y-auto md:overflow-hidden transition-colors duration-200">
        <ThemeProvider>
          <ToastProvider>
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
                    <Image
                      src={seloraxLogo}
                      alt="SeloraX Logo"
                      height={22}
                      width={88}
                      priority
                      className="h-5 sm:h-5.5 w-auto object-contain"
                    />
                  </div>
                  <span className="hidden sm:inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    Team Directory
                  </span>
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

              {/* Main Content Area: Centered and responsive without unnecessary bottom padding */}
              <main className="relative z-10 w-full max-w-4xl px-3 sm:px-4 py-1 sm:py-2 flex-1 flex flex-col items-center justify-center min-h-0">
                {children}
              </main>

              {/* Ultra-compact global footer */}
              <footer className="relative z-10 w-full py-1.5 sm:py-2 shrink-0 text-center text-[10px] text-zinc-400 dark:text-zinc-600 font-mono-numbers">
                SeloraX Precision Directory • SX-EMS v2.4
              </footer>
            </div>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
