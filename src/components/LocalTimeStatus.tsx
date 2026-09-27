'use client';

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import type { UserStatus } from '@/lib/team';

interface LocalTimeStatusProps {
  timezone?: string;
  status?: UserStatus;
}

export default function LocalTimeStatus({ timezone = 'Asia/Dhaka', status }: LocalTimeStatusProps) {
  const [timeString, setTimeString] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const updateClock = () => {
      try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        setTimeString(formatter.format(now));
      } catch {
        const now = new Date();
        setTimeString(now.toLocaleTimeString());
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  const isAvailable = status?.available ?? true;
  const statusText = status?.text || 'Available';

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
      {/* Live local time pill */}
      <div 
        className="flex items-center gap-1 rounded-full border border-zinc-200/80 bg-zinc-100/80 px-2 py-0.5 text-zinc-600 dark:border-zinc-800/90 dark:bg-zinc-800/60 dark:text-zinc-400 font-mono-numbers"
        title={`Local time in ${timezone}`}
      >
        <Clock className="h-2.5 w-2.5 text-zinc-400 dark:text-zinc-500" />
        <span>{mounted ? timeString || '--:--:--' : '--:--:--'}</span>
        <span className="text-[9px] text-zinc-400 dark:text-zinc-500">Dhaka (UTC+6)</span>
      </div>

      {/* Availability / status pill */}
      <div className="flex items-center gap-1 rounded-full border border-zinc-200/80 bg-zinc-100/80 px-2 py-0.5 text-zinc-700 dark:border-zinc-800/90 dark:bg-zinc-800/60 dark:text-zinc-300">
        <span className="relative flex h-1.5 w-1.5">
          {isAvailable && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 duration-1000" />
          )}
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
              isAvailable ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
        </span>
        <span className="font-medium text-[10px]">{statusText}</span>
      </div>
    </div>
  );
}
