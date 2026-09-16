import { ImageResponse } from 'next/og';

// Generated rather than a cropped logo file: the SeloraX wordmark is 4:1 and unreadable at 32px.
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #3730a3 55%, #f97316 100%)',
          color: 'white',
          fontSize: 22,
          fontWeight: 700,
          borderRadius: 6,
        }}
      >
        S
      </div>
    ),
    size,
  );
}
