'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from './Toast';

interface CopyableValueProps {
  value: string;
  label: string;
  isMono?: boolean;
}

export default function CopyableValue({ value, label, isMono = false }: CopyableValueProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(value).then(() => {
        setCopied(true);
        toast(`${label} copied`, value, 'copy');
        setTimeout(() => setCopied(false), 1600);
      }).catch(() => {});
    }
  }, [value, label, toast]);

  return (
    <div className="group flex min-w-0 flex-1 items-center justify-between gap-2 py-0.5">
      <button
        type="button"
        onClick={handleCopy}
        title={`Click to copy ${label.toLowerCase()}`}
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-start text-left focus:outline-none"
      >
        <span
          className={`text-xs font-semibold text-zinc-900 transition-colors group-hover:text-orange-600 dark:text-zinc-100 dark:group-hover:text-orange-400 break-all ${
            isMono ? 'font-mono-numbers' : ''
          }`}
        >
          {value}
        </span>
        <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
          {label} (Click to copy)
        </span>
      </button>

      <button
        type="button"
        onClick={handleCopy}
        title={`Copy ${label}`}
        aria-label={`Copy ${label}`}
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-zinc-400 opacity-60 transition-all hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-700 hover:opacity-100 active:scale-95 group-hover:opacity-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
