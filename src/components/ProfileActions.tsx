'use client';

import { useState } from 'react';
import type { PublicUser, ProfileData } from '@/lib/team';

interface ProfileActionsProps {
  user: PublicUser;
  profileData: ProfileData | null;
}

export default function ProfileActions({ user, profileData }: ProfileActionsProps) {
  const [showQR, setShowQR] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleDownloadVCard = () => {
    const fullName = user.name || 'Team Member';
    const email = profileData?.email || '';
    const phone = profileData?.personalPhone || profileData?.phone || '';
    const businessPhone = profileData?.businessPhone || '';
    const title = user.designation || user.role || '';
    const org = 'SeloraX';

    // Construct standard vCard 3.0
    const vCardLines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${fullName}`,
      `ORG:${org}`,
      `TITLE:${title}`,
      email ? `EMAIL;TYPE=INTERNET:${email}` : '',
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
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard?.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${user.name} - SeloraX Team Profile`,
          text: `Connect with ${user.name} at SeloraX`,
          url: window.location.href,
        });
        return;
      } catch {
        // Fallback to QR modal if user cancels or share fails
      }
    }
    setShowQR(true);
  };

  const currentUrl = typeof window !== 'undefined' ? window.location.href : `https://selorax.io/${user.username || ''}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(currentUrl)}&margin=10`;

  return (
    <>
      <div className="mx-4 mb-4 flex items-center gap-2 sm:mx-5">
        <button
          type="button"
          onClick={handleDownloadVCard}
          className="flex flex-1 cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-slate-800 active:scale-[0.98]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z" />
          </svg>
          Save Contact
        </button>

        <button
          type="button"
          onClick={() => setShowQR(true)}
          className="flex cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 active:scale-[0.98]"
          title="Show QR Code & Share"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d="M3 11h8V3H3v8zm2-6h4v4H5V5zm8-2v8h8V3h-8zm6 6h-4V5h4v4zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm13-2h-2v3h-3v2h3v3h2v-3h3v-2h-3v-3zm-3 7h2v2h-2v-2z" />
          </svg>
          QR & Share
        </button>
      </div>

      {showQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs transition-opacity"
          onClick={() => setShowQR(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Scan to View Profile</h3>
              <button
                type="button"
                onClick={() => setShowQR(false)}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border border-slate-100 bg-white p-2 shadow-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeUrl}
                alt={`QR code for ${user.name}`}
                className="h-full w-full rounded-lg object-contain"
              />
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Scan with any phone camera to instantly open {user.name}&apos;s profile card.
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 cursor-pointer rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                {copiedLink ? 'Link Copied!' : 'Copy Link'}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-indigo-600 to-orange-500 py-2.5 text-xs font-semibold text-white transition hover:from-indigo-500 hover:to-orange-400"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
