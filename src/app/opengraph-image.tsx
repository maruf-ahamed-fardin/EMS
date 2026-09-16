import { ImageResponse } from 'next/og';

// Shown when the search page itself is shared.
export const alt = 'Team-SeloraX';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #f97316 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 76, fontWeight: 700, letterSpacing: -2 }}>Team-SeloraX</div>
        <div style={{ fontSize: 34, marginTop: 20, color: '#c7d2fe' }}>
          Find and connect with the SeloraX team
        </div>
      </div>
    ),
    size,
  );
}
