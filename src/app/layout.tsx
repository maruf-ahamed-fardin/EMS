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

      <body className="antialiased min-h-dvh transition-colors duration-200">
        <ThemeProvider>
          <ToastProvider>
            <div className="relative min-h-dvh flex flex-col items-center overflow-x-hidden selection:bg-orange-500/20 selection:text-orange-500">
              {/* Engineering micro-dot background with radial gradient mask */}
              <div className="pointer-events-none fixed inset-0 bg-grid-dots opacity-75 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_0%,#000_50%,transparent_100%)] z-0" />

              {/* Navigation Bar / Top Bar */}
              <header className="relative z-10 w-full max-w-4xl px-4 pt-6 pb-4 sm:pt-8 sm:pb-6 flex items-center justify-between">
                <Link
                  href="/"
                  className="group flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition-all hover:opacity-95"
                >
                  {/* Logo Container with subtle highlight for contrast in both dark & light */}
                  <div className="relative flex items-center justify-center rounded-xl bg-white/90 dark:bg-zinc-900/80 px-3 py-1.5 border border-zinc-200/90 dark:border-zinc-800/90 shadow-2xs backdrop-blur-md transition-all group-hover:border-zinc-300 dark:group-hover:border-zinc-700">
                    <Image
                      src={seloraxLogo}
                      alt="SeloraX Logo"
                      height={26}
                      width={104}
                      priority
                      className="h-6 w-auto object-contain"
                    />
                  </div>
                  <span className="hidden sm:inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    Team Directory
                  </span>
                </Link>

                <div className="flex items-center gap-2">
                  <Link
                    href="/"
                    className="flex items-center gap-1.5 rounded-xl border border-zinc-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs backdrop-blur-md transition-all hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    Directory
                  </Link>

                  <a
                    href="https://selorax.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs backdrop-blur-md transition-all hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    selorax.io ↗
                  </a>

                  <ThemeToggle />
                </div>
              </header>

              {/* Main App Container */}
              <main className="relative z-10 w-full max-w-4xl px-4 pb-20 flex-1 flex flex-col items-center justify-start">
                {children}
              </main>

              {/* Minimalist global engineering watermark */}
              <footer className="relative z-10 w-full py-6 text-center text-[11px] text-zinc-400 dark:text-zinc-600 font-mono-numbers">
                SeloraX Precision Directory • SX-EMS v2.4
              </footer>
            </div>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
