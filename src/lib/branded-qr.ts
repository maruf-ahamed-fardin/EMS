import QRCode from 'qrcode';

export function generateBrandedQrSvg(url: string): string {
  // Use Error Correction Level 'H' (30% error recovery)
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  const margin = 2.5;
  const totalSize = size + margin * 2;

  // Center clearance for the circular emblem (matches the SeloraX t-shirt design)
  const centerMid = size / 2;
  const centerRadius = 3.6;

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

  const dots: string[] = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.modules.get(r, c)) {
        if (isCornerEye(r, c) || isCenterLogoZone(r, c)) {
          continue;
        }
        const x = c + margin;
        const y = r + margin;
        // Crisp white modules on dark background, exactly like the SeloraX t-shirt
        dots.push(
          `<rect x="${(x + 0.05).toFixed(2)}" y="${(y + 0.05).toFixed(2)}" width="0.9" height="0.9" rx="0.22" fill="#FFFFFF" />`
        );
      }
    }
  }

  // Draw the 3 Bold Electric Orange Corner Eyes matching the official SeloraX T-Shirt
  const renderEye = (cornerX: number, cornerY: number) => {
    const ox = cornerX + margin;
    const oy = cornerY + margin;

    return `
      <g>
        <!-- Outer Dark Backing + Bold Electric Orange Rounded Frame -->
        <rect x="${ox}" y="${oy}" width="7" height="7" rx="2" fill="#0A0A0C" stroke="#FF7A00" stroke-width="1.3" />
        <!-- Inner Bold Electric Orange Rounded Pupil -->
        <rect x="${ox + 1.85}" y="${oy + 1.85}" width="3.3" height="3.3" rx="1.1" fill="#FF7A00" />
      </g>
    `;
  };

  const eyeTL = renderEye(0, 0);
  const eyeTR = renderEye(size - 7, 0);
  const eyeBL = renderEye(0, size - 7);

  const midCoord = (size / 2 + margin).toFixed(2);
  const imgCoord = (parseFloat(midCoord) - 2.8).toFixed(2);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" shape-rendering="geometricPrecision" class="h-full w-full">
      <!-- Dark Obsidian Background matching the T-Shirt Fabric -->
      <rect x="0" y="0" width="${totalSize}" height="${totalSize}" fill="#0A0A0C" rx="4" />

      <!-- QR Crisp White Data Modules -->
      ${dots.join('\n')}

      <!-- 3 T-Shirt Style Bold Electric Orange Corner Eyes -->
      ${eyeTL}
      ${eyeTR}
      ${eyeBL}

      <!-- Center White Circular Emblem Shield matching T-Shirt -->
      <circle cx="${midCoord}" cy="${midCoord}" r="4.2" fill="#FFFFFF" stroke="#FF7A00" stroke-width="0.35" />

      <!-- Embedded SeloraX 'X' Emblem -->
      <image href="/icon.png" x="${imgCoord}" y="${imgCoord}" width="5.6" height="5.6" preserveAspectRatio="xMidYMid meet" />
    </svg>
  `;
}
