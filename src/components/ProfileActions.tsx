'use client';

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Calendar, Download, QrCode, Share2, Copy, Check, X } from 'lucide-react';
import type { PublicUser, ProfileData } from '@/lib/team';
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

  // Generate offline SVG QR code whenever modal opens
  useEffect(() => {
    if (showQR && currentUrl) {
      QRCode.toString(currentUrl, {
        type: 'svg',
        margin: 1,
        color: {
          dark: '#090B0E',
          light: '#FFFFFF',
        },
      })
        .then((svg) => setQrSvg(svg))
        .catch(() => {});
    }
  }, [showQR, currentUrl]);

  // Close modal on Escape key
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

    // Construct standard vCard 3.0 format
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
        // Fallback to QR modal if user cancels or share is not supported
      }
    }
    handleCopyLink();
  };

  const calendlyUrl = profileData?.calendlyUrl || user.calendlyUrl;

  return (
    <div className="mx-4 mb-4 sm:mx-6 space-y-2">
      {/* Primary Action Row: Save Contact + QR & Share */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={handleDownloadVCard}
          className="flex cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          <Download className="h-4 w-4" />
          Save Contact
        </button>

        <button
          type="button"
          onClick={() => setShowQR(true)}
          className="flex cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-4 py-3 text-xs font-semibold text-zinc-800 shadow-2xs transition hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/80"
          title="Show QR Code & Share"
        >
          <QrCode className="h-4 w-4 text-orange-500" />
          QR & Share
        </button>
      </div>

      {/* Optional "Book Meeting" button (Cal.com / Calendly style) */}
      {calendlyUrl && (
        <a
          href={calendlyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-500/20 active:scale-[0.98] dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-300 dark:hover:bg-amber-400/20"
        >
          <Calendar className="h-3.5 w-3.5" />
          Book a 1:1 Meeting (Cal.com)
        </a>
      )}

      {/* Accessible QR Modal */}
      {showQR && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          onClick={() => setShowQR(false)}
        >
          <div
            className="tactile-card w-full max-w-xs rounded-3xl p-6 text-center shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 id="qr-modal-title" className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Scan to View Profile
              </h3>
              <button
                type="button"
                onClick={() => setShowQR(false)}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Offline SVG QR container */}
            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-inner dark:border-zinc-800">
              {qrSvg ? (
                <div
                  className="h-full w-full [&_svg]:h-full [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <div className="flex items-center justify-center text-xs text-zinc-400">
                  Generating QR…
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Scan with any phone camera to instantly open {user.name}&apos;s profile card.
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-100 py-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Link
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-orange-600 py-2.5 text-xs font-semibold text-white transition hover:bg-orange-500 shadow-sm"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
