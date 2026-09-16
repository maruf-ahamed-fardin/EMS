import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import seloraxLogo from '@/assets/SeloraX logo.png';
import { siteUrl } from '@/lib/site';
import './globals.css';

const title = 'Team-SeloraX';
const description = 'Find and connect with members of the SeloraX team.';

export const metadata: Metadata = {
  // Makes the relative URLs below absolute, which link previews require
  metadataBase: new URL(siteUrl()),
  title: { default: title, template: '%s | Team-SeloraX' },
  description,
  applicationName: title,
  // Profile cards are shared in chat apps far more often than they are searched for,
  // so these tags decide how most people first see the site.
  openGraph: { type: 'website', siteName: title, title, description, url: '/' },
  twitter: { card: 'summary_large_image', title, description },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets the header gradient run under the notch; safe-area padding keeps content clear of it
  viewportFit: 'cover',
  themeColor: '#1e1b4b',
};

// Shared shell: the logo over an ambient glow, with the page card centred beneath it.
// Living in the layout means the background stays put while navigating between pages.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      {/*
        Extensions (ColorZilla's cz-shortcut-listen, Grammarly's data-gr-*, password managers)
        add attributes to <body> before React hydrates, which React reports as a mismatch even
        though the server HTML is correct. This suppresses that comparison for this element's own
        attributes only - children are still checked, and nothing here is dynamic.
      */}
      <body className="antialiased" suppressHydrationWarning>
        <div className="relative flex min-h-dvh flex-col items-center overflow-hidden bg-slate-950">
          {/*
            Two blurred colour fields rather than a gradient band. The old header ended in a hard
            horizontal line across the page where its gradient met the one behind it; light that
            falls off has no edge to give away.
          */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[38rem]">
            <div className="absolute -top-56 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-indigo-600/35 blur-[130px]" />
            <div className="absolute -top-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-orange-500/25 blur-[120px]" />
            <div className="absolute -top-32 -left-32 h-[26rem] w-[26rem] rounded-full bg-violet-600/25 blur-[120px]" />
          </div>

          <header className="relative z-10 flex w-full justify-center px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-10 sm:pt-16 sm:pb-12">
            <a
              href="https://selorax.io"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-80"
            >
              <Image
                src={seloraxLogo}
                alt="SeloraX"
                sizes="176px"
                preload
                className="h-8 w-auto brightness-0 invert sm:h-10"
              />
            </a>
          </header>

          {/* Centred on anything taller than the card, so a desktop window is not mostly empty */}
          <main className="relative z-10 flex w-full flex-1 justify-center px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-16">
            <div className="w-full max-w-sm sm:max-w-md">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
