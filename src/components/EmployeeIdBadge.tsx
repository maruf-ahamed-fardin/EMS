'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from './Toast';

interface EmployeeIdBadgeProps {
  employeeId?: string;
}

export default function EmployeeIdBadge({ employeeId }: EmployeeIdBadgeProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!employeeId) return null;

  const handleCopy = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(employeeId).then(() => {
        setCopied(true);
        toast(`Copied ${employeeId}`, 'Employee ID copied to clipboard', 'copy');
        setTimeout(() => setCopied(false), 1800);
      }).catch(() => {});
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleCopy(e);
        }
      }}
      title="Click to copy Employee ID"
      aria-label={`Copy Employee ID ${employeeId}`}
      className="group relative inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-zinc-100/80 px-2 py-0.5 font-mono text-xs font-semibold text-zinc-700 transition-all hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-600 active:scale-95 dark:border-zinc-800/90 dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:border-amber-400/50 dark:hover:bg-amber-400/10 dark:hover:text-amber-400 shadow-2xs cursor-pointer"
    >
      <span className="font-mono-numbers tracking-tight">{employeeId}</span>
      {copied ? (
        <Check className="h-3 w-3 stroke-[2.5] text-emerald-500 animate-in fade-in" />
      ) : (
        <Copy className="h-3 w-3 text-zinc-400 group-hover:text-amber-500 transition-colors" />
      )}
      <span className="sr-only">Copy Employee ID</span>
    </button>
  );
}
