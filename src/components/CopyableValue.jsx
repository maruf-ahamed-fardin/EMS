'use client';

import { useState, useCallback } from 'react';

// Tap-to-copy value with a small caption. The whole block is the tap target,
// which keeps it comfortably large on phones.
export default function CopyableValue({ value, label }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    // navigator.clipboard is undefined on insecure (http) origins
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copy ${label.toLowerCase()}`}
      className="group flex min-w-0 flex-1 cursor-pointer touch-manipulation flex-col items-start rounded-lg py-1 text-left"
    >
      <span aria-live="polite" className="text-sm text-slate-700 transition-colors wrap-anywhere group-hover:text-indigo-600">
        {copied ? 'Copied!' : value}
      </span>
      <span className="text-[11px] font-medium text-slate-400">{label}</span>
    </button>
  );
}
