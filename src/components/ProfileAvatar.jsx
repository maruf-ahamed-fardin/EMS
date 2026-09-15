'use client';

import { useState } from 'react';

// Profile photo with an initial-letter fallback when there's no photo or it fails to load.
export default function ProfileAvatar({ src, name }) {
  const [failed, setFailed] = useState(false);

  // An image that already failed before hydration never fires onError,
  // so also check its state once it's attached.
  const checkLoaded = (img) => {
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  };

  return (
    <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-indigo-200 shadow-lg ring-4 ring-white sm:h-28 sm:w-28">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- src may be a data URL or any external host
        <img
          ref={checkLoaded}
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-600 to-orange-500 text-4xl font-bold text-white">
          {(name || '?').charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}
