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

// Shared shell: branded gradient header with the page card pulled up over it.
// Living in the layout means the header stays put while navigating between pages.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-dvh flex-col items-center bg-gradient-to-b from-indigo-950 via-indigo-900 to-slate-900">
          <header className="flex w-full justify-center bg-gradient-to-r from-indigo-950 via-indigo-800 to-orange-500 px-4 pt-[max(2.5rem,env(safe-area-inset-top))] pb-24 sm:pt-14 sm:pb-28">
            <a href="https://selorax.io" target="_blank" rel="noopener noreferrer">
              <Image
                src={seloraxLogo}
                alt="SeloraX"
                sizes="176px"
                preload
                className="h-8 w-auto brightness-0 invert sm:h-10"
              />
            </a>
          </header>
          <main className="-mt-16 w-full max-w-sm px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:max-w-md">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
