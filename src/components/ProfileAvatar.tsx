'use client';

import { useState } from 'react';

interface ProfileAvatarProps {
  src: string | null;
  name?: string;
}

// Profile photo with an initial-letter fallback when there's no photo or it fails to load.
export default function ProfileAvatar({ src, name }: ProfileAvatarProps) {
  const [failed, setFailed] = useState(false);

  // An image that already failed before hydration never fires onError,
  // so also check its state once it's attached.
  const checkLoaded = (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  };

  return (
    // The gradient ring is the outer element's background; the white border inside it is the gap
    <div className="rounded-full bg-gradient-to-br from-indigo-600 via-violet-500 to-orange-500 p-[3px] shadow-lg shadow-indigo-500/25">
      <div className="h-24 w-24 overflow-hidden rounded-full border-[3px] border-white bg-white sm:h-28 sm:w-28">
        {src && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element -- src may be a data URL or any external host
          <img
            ref={checkLoaded}
            src={src}
            // Empty rather than undefined when the name is missing: an img with no alt is read out
            // as its URL. The name is in the heading beside it either way, so this is decorative.
            alt={name ?? ''}
            className="h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-600 to-orange-500 text-4xl font-bold text-white">
            {(name || '?').charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}
