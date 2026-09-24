import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import { Providers } from '@/components/providers';
import { ThemeScript } from '@/components/theme-script';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'SeloraX EMS', template: '%s · SeloraX EMS' },
  description: 'SeloraX employee management',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0d15' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Set by proxy.ts. Reading it also keeps every page dynamic, which a per-request nonce needs.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    // ThemeScript sets the class before hydration; browser extensions also edit <body>
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript nonce={nonce} />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
