import { qrMatrix } from '@/lib/qr/generate';

/**
 * A QR code drawn as one SVG path, so it is sharp at any size and needs no image request. Always
 * dark on white, whatever the theme: scanners read that reliably and many cannot read it inverted.
 */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const matrix = qrMatrix(value);
  const size = matrix.length;
  let path = '';
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    });
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#101328" />
    </svg>
  );
}

/** The same code as a PNG, for "Download QR". Drawn on a canvas, so it needs no library. */
export function qrPngBlob(value: string, pixels = 640): Promise<Blob | null> {
  const matrix = qrMatrix(value);
  const size = matrix.length;
  const scale = Math.max(1, Math.floor(pixels / size));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size * scale;
  const context = canvas.getContext('2d');
  if (!context) return Promise.resolve(null);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#101328';
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) context.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
