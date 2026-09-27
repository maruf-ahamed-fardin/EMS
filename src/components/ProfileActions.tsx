'use client';

import { useState, useEffect } from 'react';
import { Calendar, Download, QrCode, Share2, Copy, Check, X, BadgeCheck } from 'lucide-react';
import type { PublicUser, ProfileData } from '@/lib/team';
import { generateBrandedQrSvg } from '@/lib/branded-qr';
import { useToast } from './Toast';

interface ProfileActionsProps {
  user: PublicUser;
  profileData: ProfileData | null;
}

export default function ProfileActions({ user, profileData }: ProfileActionsProps) {
  const [showQR, setShowQR] = useState(false);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const { toast } = useToast();

  const currentUrl = typeof window !== 'undefined'
    ? window.location.href
    : `https://selorax.io/${encodeURIComponent(user.username || '')}`;

  useEffect(() => {
    if (showQR && currentUrl) {
      try {
        const svg = generateBrandedQrSvg(currentUrl);
        setQrSvg(svg);
      } catch (err) {
        console.error('Failed to generate branded QR SVG:', err);
      }
    }
  }, [showQR, currentUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowQR(false);
    };
    if (showQR) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showQR]);

  const handleDownloadVCard = () => {
    const fullName = user.name || 'Team Member';
    const email = profileData?.email || '';
    const phone = profileData?.personalPhone || profileData?.phone || '';
    const businessPhone = profileData?.businessPhone || '';
    const title = user.designation || user.role || '';
    const org = 'SeloraX';

    const vCardLines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${fullName}`,
      `ORG:${org}`,
      `TITLE:${title}`,
      email ? `EMAIL;TYPE=INTERNET,WORK:${email}` : '',
      phone ? `TEL;TYPE=CELL:${phone}` : '',
      businessPhone ? `TEL;TYPE=WORK:${businessPhone}` : '',
      'URL:https://selorax.io',
      'END:VCARD',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([vCardLines], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(user.username || 'contact').toLowerCase()}-selorax.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast('Contact card saved', 'Downloaded .vcf file for your address book', 'success');
  };

  const handleDownloadQr = () => {
    if (!qrSvg || typeof window === 'undefined') return;
    try {
      const canvas = document.createElement('canvas');
      const size = 1024;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const svgBlob = new Blob([qrSvg], { type: 'image/svg+xml;charset=utf-8' });
      const blobURL = URL.createObjectURL(svgBlob);
      const img = new Image();

      img.onload = () => {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);

        // Overlay authentic SeloraX center emblem
        const logo = new Image();
        logo.onload = () => {
          const logoSize = size * 0.17;
          const logoPos = (size - logoSize) / 2;
          ctx.drawImage(logo, logoPos, logoPos, logoSize, logoSize);

          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = `${(user.username || 'selorax').toLowerCase()}-qr.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(blobURL);
          toast('QR Code downloaded', 'High-resolution branded QR saved', 'success');
        };
        logo.onerror = () => {
          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = `${(user.username || 'selorax').toLowerCase()}-qr.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          URL.revokeObjectURL(blobURL);
          toast('QR Code downloaded', 'Branded QR saved', 'success');
        };
        logo.src = '/icon.png';
      };
      img.src = blobURL;
    } catch (err) {
      console.error('Failed to download QR:', err);
      toast('Download failed', 'Please try again', 'info');
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl).then(() => {
        setCopiedLink(true);
        toast('Profile link copied', currentUrl, 'copy');
        setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${user.name} - SeloraX Team Profile`,
          text: `Connect with ${user.name} at SeloraX`,
          url: currentUrl,
        });
        toast('Shared profile', 'Shared successfully via Web Share API', 'success');
        return;
      } catch {
        // Fallback to copy link
      }
    }
    handleCopyLink();
  };

  const calendlyUrl = profileData?.calendlyUrl || user.calendlyUrl;

  return (
    <div className="space-y-1.5">
      {/* Primary Action Row: Save Contact + QR & Share */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={handleDownloadVCard}
          className="flex cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          <Download className="h-3.5 w-3.5" />
          Save Contact
        </button>

        <button
          type="button"
          onClick={() => setShowQR(true)}
          className="flex cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-2xs transition hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
          title="Show Branded QR Code & Share"
        >
          <QrCode className="h-3.5 w-3.5 text-orange-500" />
          QR & Share
        </button>
      </div>

      {/* Optional "Book Meeting" button */}
      {calendlyUrl && (
        <a
          href={calendlyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-500/20 active:scale-[0.98] dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20"
        >
          <Calendar className="h-3 w-3" />
          Book a 1:1 Meeting (Cal.com)
        </a>
      )}

      {/* Branded SeloraX QR Modal */}
      {showQR && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
          onClick={() => setShowQR(false)}
        >
          <div
            className="tactile-card w-full max-w-xs rounded-3xl p-5 text-center shadow-2xl animate-in zoom-in-95 duration-150 border border-zinc-200/90 dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="mb-3.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                <h3 id="qr-modal-title" className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  SeloraX Digital ID
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQR(false)}
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
                aria-label="Close dialog"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Member Mini Identification Chip */}
            <div className="mb-3 flex items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/90 px-3 py-1.5 dark:border-zinc-800/80 dark:bg-zinc-900/90">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-900 to-amber-600 font-bold text-[10px] text-white">
                  {(user.name || '?').charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  {user.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {user.employeeId && (
                  <span className="font-mono text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                    {user.employeeId}
                  </span>
                )}
                <BadgeCheck className="h-3.5 w-3.5 text-blue-500" />
              </div>
            </div>

            {/* Custom Branded SeloraX QR Container (Navy + Orange Palette) */}
            <div className="relative mx-auto flex h-48 w-48 sm:h-52 sm:w-52 items-center justify-center rounded-2xl border-2 border-orange-500/40 bg-white p-2.5 shadow-[0_0_35px_-5px_rgba(255,122,0,0.35),0_0_40px_-10px_rgba(26,33,107,0.4)] dark:border-orange-500/50">
              {/* Dual-Brand Corner Tech Brackets (Navy on Left, Orange on Right) */}
              <div className="pointer-events-none absolute -top-1 -left-1 h-3.5 w-3.5 border-t-2 border-l-2 border-[#1E2574] rounded-tl" />
              <div className="pointer-events-none absolute -top-1 -right-1 h-3.5 w-3.5 border-t-2 border-r-2 border-[#FF7A00] rounded-tr" />
              <div className="pointer-events-none absolute -bottom-1 -left-1 h-3.5 w-3.5 border-b-2 border-l-2 border-[#1E2574] rounded-bl" />
              <div className="pointer-events-none absolute -bottom-1 -right-1 h-3.5 w-3.5 border-b-2 border-r-2 border-[#FF7A00] rounded-br" />

              {/* QR Vector SVG with SeloraX Navy-to-Orange Gradient & Squircle Dots */}
              {qrSvg ? (
                <div
                  className="h-full w-full [&_svg]:h-full [&_svg]:w-full overflow-hidden rounded-xl"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <div className="flex items-center justify-center text-xs text-zinc-400">
                  Generating QR…
                </div>
              )}

              {/* Center SeloraX Logo Emblem positioned over the shield */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/icon.png"
                    alt="SeloraX"
                    className="h-full w-full object-contain drop-shadow-sm"
                  />
                </div>
              </div>
            </div>

            <p className="mt-3 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              Scan with camera to connect or download below.
            </p>

            {/* Action Buttons: Download QR + Copy Link + Share */}
            <div className="mt-3.5 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="flex cursor-pointer items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 py-2 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 active:scale-95"
                title="Download High-Res QR Code"
              >
                <Download className="h-3 w-3 text-orange-500" />
                Download
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex cursor-pointer items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 py-2 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 active:scale-95"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 py-2 text-[11px] font-semibold text-white shadow-md shadow-orange-500/25 transition hover:from-orange-400 hover:to-amber-500 active:scale-95"
              >
                <Share2 className="h-3 w-3" />
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
