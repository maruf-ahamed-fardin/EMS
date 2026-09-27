import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import seloraxLogo from '@/assets/SeloraX logo.png';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Team-SeloraX', template: '%s | Team-SeloraX' },
  description: 'Find and connect with members of the SeloraX team.',
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
  themeColor: '#f8fafc',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased font-sans text-slate-900 bg-slate-50 min-h-dvh">
        <div className="relative min-h-dvh flex flex-col items-center overflow-x-hidden bg-slate-50">
          {/* Subtle Ambient luminous glow & dot grid pattern */}
          <div className="pointer-events-none fixed inset-0 ambient-glow z-0" />
          <div className="pointer-events-none fixed inset-0 bg-grid-pattern opacity-50 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_60%,transparent_100%)] z-0" />

          {/* Clean, airy header with transparent logo */}
          <header className="relative z-10 flex w-full justify-center px-4 pt-10 pb-8 sm:pt-14 sm:pb-10">
            <a
              href="https://selorax.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block transition-transform duration-300 hover:scale-105 active:scale-95"
            >
              <Image
                src={seloraxLogo}
                alt="SeloraX"
                sizes="176px"
                preload
                className="h-9 w-auto sm:h-11 transition-all"
              />
            </a>
          </header>

          {/* Main Card container */}
          <main className="relative z-10 w-full max-w-sm px-4 pb-16 sm:max-w-md">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
