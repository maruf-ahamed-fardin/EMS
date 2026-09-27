'use client';

import { useState } from 'react';
import { BadgeCheck } from 'lucide-react';

export interface ProfileAvatarProps {
  src: string | null;
  name?: string;
  verified?: boolean;
}

export default function ProfileAvatar({ src, name, verified = true }: ProfileAvatarProps) {
  const [failed, setFailed] = useState(false);

  const checkLoaded = (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  };

  const initial = (name || '?').charAt(0).toUpperCase();

  return (
    <div className="relative inline-block">
      {/* Outer tactile double border */}
      <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full p-1 border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 shadow-md shadow-black/5 dark:shadow-black/20">
        <div className="h-full w-full overflow-hidden rounded-full border border-zinc-100 dark:border-zinc-800/60 bg-zinc-100 dark:bg-zinc-800">
          {src && !failed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={checkLoaded}
              src={src}
              alt={name || 'Team member avatar'}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-900 via-zinc-900 to-amber-700 text-3xl sm:text-4xl font-bold text-white select-none">
              {initial}
            </div>
          )}
        </div>
      </div>

      {/* Verified Badge */}
      {verified && (
        <div
          title="Verified SeloraX Member"
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-sm dark:border-zinc-900 dark:bg-blue-500"
        >
          <BadgeCheck className="h-4 w-4 stroke-[2.5]" />
        </div>
      )}
    </div>
  );
}
