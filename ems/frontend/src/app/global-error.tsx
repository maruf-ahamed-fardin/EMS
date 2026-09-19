'use client';

// Replaces the root layout when it fails, so it can't rely on the app's styles or providers
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100dvh', margin: 0 }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
          <p style={{ color: '#5a6078' }}>SeloraX People couldn&rsquo;t load. Try again in a moment.</p>
          {error.digest && <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#5a6078' }}>Reference: {error.digest}</p>}
          <button type="button" onClick={retry} style={{ marginTop: 16, padding: '10px 16px', borderRadius: 9, border: 0, background: '#5b4bff', color: '#fff', fontWeight: 600 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
