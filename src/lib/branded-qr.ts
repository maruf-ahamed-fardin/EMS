import QRCode from 'qrcode';

export function generateBrandedQrSvg(url: string): string {
  // 1. Actual QR Code Algorithm with Error Correction Level 'H' (30% recovery capability)
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;

  // 2. Sufficient white margin (quiet zone of ~ 3.5 modules)
  const margin = 3.5;
  const totalSize = size + margin * 2;

  // 3. Center logo clearance zone (proper white quiet zone for error correction)
  const centerMid = size / 2;
  const centerRadius = 3.8;

  const isCornerEye = (r: number, c: number) => {
    if (r < 7 && c < 7) return true; // Top-left
    if (r < 7 && c >= size - 7) return true; // Top-right
    if (r >= size - 7 && c < 7) return true; // Bottom-left
    return false;
  };

  const isCenterLogoZone = (r: number, c: number) => {
    const dr = r - centerMid + 0.5;
    const dc = c - centerMid + 0.5;
    return Math.sqrt(dr * dr + dc * dc) <= centerRadius;
  };

  const modules: string[] = [];

  // Dark charcoal / near-black color for optimal contrast without harsh pure black
  const darkCharcoal = '#181A22';
  // Authentic SeloraX Orange for outer finder pattern
  const seloraxOrange = '#FFA000';

  // 4. Each data module is a perfect flat square (shape-rendering: crispEdges)
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.modules.get(r, c)) {
        if (isCornerEye(r, c) || isCenterLogoZone(r, c)) {
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

  // 5. 3 Finder patterns: Exact position/size (7x7), outer part in SeloraX Orange, white separator, dark charcoal pupil
  const renderEye = (cornerX: number, cornerY: number) => {
    const ox = cornerX + margin;
    const oy = cornerY + margin;

    return `
      <g>
        <!-- Outer Frame: SeloraX Orange (7x7 modules, 1 module thick) -->
        <rect x="${ox}" y="${oy}" width="7" height="7" rx="0.75" fill="${seloraxOrange}" />
        <!-- Inner Separation White Buffer (5x5 modules) -->
        <rect x="${ox + 1}" y="${oy + 1}" width="5" height="5" rx="0.35" fill="#FFFFFF" />
        <!-- Center Pupil: Dark Charcoal (3x3 modules) -->
        <rect x="${ox + 2}" y="${oy + 2}" width="3" height="3" rx="0.3" fill="${darkCharcoal}" />
      </g>
    `;
  };

  const eyeTL = renderEye(0, 0);
  const eyeTR = renderEye(size - 7, 0);
  const eyeBL = renderEye(0, size - 7);

  const midCoord = (size / 2 + margin).toFixed(2);
  const imgCoord = (parseFloat(midCoord) - 2.7).toFixed(2);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="crispEdges" class="h-full w-full">
      <!-- 100% Flat, Crisp White Canvas with Quiet Zone Margin -->
      <rect x="0" y="0" width="${totalSize}" height="${totalSize}" fill="#FFFFFF" rx="2" />

      <!-- Perfect Square Data Modules (Dark Charcoal) -->
      ${modules.join('\n')}

      <!-- 3 Finder Patterns with SeloraX Orange Outer Frame -->
      ${eyeTL}
      ${eyeTR}
      ${eyeBL}

      <!-- Center Logo Proper White Quiet Zone -->
      <circle cx="${midCoord}" cy="${midCoord}" r="4.2" fill="#FFFFFF" shape-rendering="geometricPrecision" />

      <!-- Center SeloraX 'X' Emblem -->
      <image href="/icon.png" x="${imgCoord}" y="${imgCoord}" width="5.4" height="5.4" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision" />
    </svg>
  `;
}
