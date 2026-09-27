import QRCode from 'qrcode';

export function generateBrandedQrSvg(url: string): string {
  // 1. Actual QR Code Algorithm with Error Correction Level 'H' (30% recovery capability)
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;

  // 2. Sufficient white margin (quiet zone of ~ 3.5 modules)
  const margin = 3.5;
  const totalSize = size + margin * 2;

  const isCornerEye = (r: number, c: number) => {
    if (r < 7 && c < 7) return true; // Top-left
    if (r < 7 && c >= size - 7) return true; // Top-right
    if (r >= size - 7 && c < 7) return true; // Bottom-left
    return false;
  };

  const modules: string[] = [];

  // Dark charcoal / near-black color for optimal contrast without harsh pure black
  const darkCharcoal = '#181A22';
  // Authentic SeloraX Orange for outer finder pattern
  const seloraxOrange = '#FFA000';

  // 3. Render data modules as crisp perfect squares across the entire grid
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.modules.get(r, c)) {
        if (isCornerEye(r, c)) {
          continue;
        }
        const x = c + margin;
        const y = r + margin;
        modules.push(
          `<rect x="${x}" y="${y}" width="1" height="1" fill="${darkCharcoal}" />`
        );
      }
    }
  }

  // 4. 3 Finder patterns: Exact position/size (7x7), outer part in SeloraX Orange, white separator, dark charcoal pupil
  const renderEye = (cornerX: number, cornerY: number) => {
    const ox = cornerX + margin;
    const oy = cornerY + margin;

    return `
      <g>
        <!-- Outer Frame: SeloraX Orange (7x7 modules, 1 module thick) -->
        <rect x="${ox}" y="${oy}" width="7" height="7" rx="0.5" fill="${seloraxOrange}" />
        <!-- Inner Separation White Buffer (5x5 modules) -->
        <rect x="${ox + 1}" y="${oy + 1}" width="5" height="5" rx="0.3" fill="#FFFFFF" />
        <!-- Center Pupil: Dark Charcoal (3x3 modules) -->
        <rect x="${ox + 2}" y="${oy + 2}" width="3" height="3" rx="0.2" fill="${darkCharcoal}" />
      </g>
    `;
  };

  const eyeTL = renderEye(0, 0);
  const eyeTR = renderEye(size - 7, 0);
  const eyeBL = renderEye(0, size - 7);

  const mid = size / 2 + margin;
  // Center Circular Quiet Zone: Smooth white disc covering center modules with ample round blank space around logo
  const circleRadius = 4.6;
  // Center logo: 2.6 modules (leaves ~3.3 modules of clean round blank space on all 4 sides)
  const logoSize = 2.6;
  const logoPos = mid - logoSize / 2;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges" class="h-full w-full">
      <!-- 100% Flat, Crisp White Canvas with Quiet Zone Margin -->
      <rect x="0" y="0" width="${totalSize}" height="${totalSize}" fill="#FFFFFF" />

      <!-- Perfect Square Data Modules (Dark Charcoal) -->
      ${modules.join('\n')}

      <!-- 3 Finder Patterns with SeloraX Orange Outer Frame -->
      ${eyeTL}
      ${eyeTR}
      ${eyeBL}

      <!-- Center Logo Proper White Quiet Zone: Smooth circular disc covering center modules with ample blank space -->
      <circle cx="${mid.toFixed(2)}" cy="${mid.toFixed(2)}" r="${circleRadius.toFixed(2)}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="0.3" shape-rendering="geometricPrecision" />

      <!-- Center SeloraX 'X' Emblem with uniform rounded gap on all 4 sides -->
      <image href="/icon.png" x="${logoPos.toFixed(2)}" y="${logoPos.toFixed(2)}" width="${logoSize.toFixed(2)}" height="${logoSize.toFixed(2)}" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision" />
    </svg>
  `;
}
