import QRCode from 'qrcode';

export function generateBrandedQrSvg(url: string): string {
  // Use Error Correction Level 'H' (30% recovery capability)
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  const margin = 2;
  const totalSize = size + margin * 2;

  // Center clearance for logo (7x7 module zone in the middle)
  const centerRadius = 3;
  const centerMid = Math.floor(size / 2);
  const centerStart = centerMid - centerRadius;
  const centerEnd = centerMid + centerRadius;

  const isCornerEye = (r: number, c: number) => {
    if (r < 7 && c < 7) return true; // Top-left
    if (r < 7 && c >= size - 7) return true; // Top-right
    if (r >= size - 7 && c < 7) return true; // Bottom-left
    return false;
  };

  const isCenterLogoZone = (r: number, c: number) => {
    return r >= centerStart && r <= centerEnd && c >= centerStart && c <= centerEnd;
  };

  const dots: string[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.modules.get(r, c)) {
        if (isCornerEye(r, c) || isCenterLogoZone(r, c)) {
          continue;
        }
        const x = c + margin;
        const y = r + margin;
        // Fuller rounded squircle dot with SeloraX logo gradient
        // 0.88 size gives deep rich colors and smooth organic feel
        dots.push(
          `<rect x="${(x + 0.06).toFixed(2)}" y="${(y + 0.06).toFixed(2)}" width="0.88" height="0.88" rx="0.36" fill="url(#selorax-main-grad)" />`
        );
      }
    }
  }

  // Draw the 3 high-contrast corner finder eyes with SeloraX logo synergy:
  // Top-Left Eye: Navy Blue Frame + Indigo/Navy Pupil (mirrors the SeloraX Navy wing)
  // Top-Right & Bottom-Left: Navy Frame + Electric Tangerine Pupil (mirrors the Orange cross arm)
  const renderEye = (cornerX: number, cornerY: number, isTopLeft: boolean) => {
    const ox = cornerX + margin;
    const oy = cornerY + margin;
    const pupilGrad = isTopLeft ? 'url(#selorax-eye-navy-grad)' : 'url(#selorax-eye-orange-grad)';
    const outerStroke = isTopLeft ? '#12174C' : 'url(#selorax-eye-outer-grad)';

    return `
      <g>
        <!-- Outer Rounded Squircle Frame with 1.15px stroke -->
        <rect x="${ox + 0.05}" y="${oy + 0.05}" width="6.9" height="6.9" rx="2.2" fill="none" stroke="${outerStroke}" stroke-width="1.15" />
        <!-- Inner Protective White Gap Buffer -->
        <rect x="${ox + 1.1}" y="${oy + 1.1}" width="4.8" height="4.8" rx="1.6" fill="none" stroke="#FFFFFF" stroke-width="0.75" />
        <!-- Center Stylized Pupil with Brand Gradient & Smooth Squircle -->
        <rect x="${ox + 1.95}" y="${oy + 1.95}" width="3.1" height="3.1" rx="1.25" fill="${pupilGrad}" />
        <!-- Micro Accent Sparkle in Pupil Center -->
        <circle cx="${ox + 3.5}" cy="${oy + 3.5}" r="0.45" fill="#FFFFFF" opacity="0.35" />
      </g>
    `;
  };

  const eyeTL = renderEye(0, 0, true);
  const eyeTR = renderEye(size - 7, 0, false);
  const eyeBL = renderEye(0, size - 7, false);

  // Center Logo Shield Coordinates
  const shieldX = centerStart + margin - 0.25;
  const shieldY = centerStart + margin - 0.25;
  const shieldW = (centerEnd - centerStart + 1) + 0.5;
  const shieldH = shieldW;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="geometricPrecision" class="h-full w-full">
      <defs>
        <!-- Full SeloraX Logo Gradient: Navy Wing (#0E123F) -> Deep Royal Indigo (#1B2476) -> Rich Tangerine Vermillion (#D64002) -> Electric Sunset Orange (#FF7500) -->
        <linearGradient id="selorax-main-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0E123F" />
          <stop offset="35%" stop-color="#1B2476" />
          <stop offset="68%" stop-color="#D64002" />
          <stop offset="100%" stop-color="#FF7500" />
        </linearGradient>

        <!-- Eye Outer Dual Gradient -->
        <linearGradient id="selorax-eye-outer-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#12174C" />
          <stop offset="70%" stop-color="#1C257C" />
          <stop offset="100%" stop-color="#DE4B04" />
        </linearGradient>

        <!-- Eye Pupil Orange Gradient (Logo Orange Stroke) -->
        <linearGradient id="selorax-eye-orange-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#FF5500" />
          <stop offset="60%" stop-color="#FF7A00" />
          <stop offset="100%" stop-color="#FFA818" />
        </linearGradient>

        <!-- Eye Pupil Navy Gradient (Logo Navy Wing) -->
        <linearGradient id="selorax-eye-navy-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0E123F" />
          <stop offset="50%" stop-color="#1A2270" />
          <stop offset="100%" stop-color="#2835A6" />
        </linearGradient>

        <!-- Shield Drop Shadow Filter -->
        <filter id="selorax-shield-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0.3" stdDeviation="0.4" flood-color="#000000" flood-opacity="0.18" />
        </filter>
      </defs>

      <!-- Crisp White Canvas for 100% Optical Sensor Reliability -->
      <rect x="0" y="0" width="${totalSize}" height="${totalSize}" fill="#FFFFFF" rx="3.5" />

      <!-- QR Data Modules with SeloraX Logo Gradient -->
      ${dots.join('\n')}

      <!-- 3 Corner Branded Eyes -->
      ${eyeTL}
      ${eyeTR}
      ${eyeBL}

      <!-- Center Brand Emblem Shield -->
      <g filter="url(#selorax-shield-shadow)">
        <!-- Shield Background -->
        <rect x="${shieldX}" y="${shieldY}" width="${shieldW}" height="${shieldH}" rx="2" fill="#FFFFFF" />
        <!-- Shield Gradient Border (Navy to Orange) -->
        <rect x="${shieldX}" y="${shieldY}" width="${shieldW}" height="${shieldH}" rx="2" fill="none" stroke="url(#selorax-main-grad)" stroke-width="0.35" />
      </g>
    </svg>
  `;
}
