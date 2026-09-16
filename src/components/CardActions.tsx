'use client';

import { useState } from 'react';
import { DownloadIcon, QrIcon } from './icons';

interface CardActionsProps {
  /** Where the vCard lives, so the button is a plain link and works without JavaScript */
  vcardHref: string;
  /** Pre-rendered on the server: a PNG data URL of the profile's own address */
  qrDataUrl: string;
  name: string;
}

const button =
  'flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 ' +
  'text-xs font-semibold text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600';

export default function CardActions({ vcardHref, qrDataUrl, name }: CardActionsProps) {
  const [showQr, setShowQr] = useState(false);

  return (
    <div className="mx-5 space-y-3 pb-1">
      <div className="flex gap-2">
        {/* A real link, not a script-driven download: it survives no-JS and long-press "save as" */}
        <a href={vcardHref} className={button} download>
          <DownloadIcon className="h-4 w-4" />
          Save contact
        </a>
        <button type="button" onClick={() => setShowQr(open => !open)} aria-expanded={showQr} className={`${button} cursor-pointer`}>
          <QrIcon className="h-4 w-4" />
          {showQr ? 'Hide QR' : 'QR code'}
        </button>
      </div>

      {showQr && (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-slate-50 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing to optimise */}
          <img src={qrDataUrl} alt={`QR code linking to ${name}'s profile`} className="h-40 w-40" />
          <p className="text-[11px] text-slate-400">Scan to open this profile</p>
        </div>
      )}
    </div>
  );
}
