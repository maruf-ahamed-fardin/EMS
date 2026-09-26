'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

/**
 * Copies one value from the card (an email address) to the clipboard. Saving the whole contact,
 * the QR code and NFC are in `CardActions`.
 */
export function SaveContactButton({ value, label }: { variant: 'copy'; value: string; label: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      // Denied clipboard permission, or an insecure origin: say so rather than fail silently
      toast.error('Could not copy. Select the text and copy it instead.');
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={label}
      className="grid size-9 shrink-0 place-items-center rounded-xl border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {done ? <Check aria-hidden className="size-4 text-success-text" /> : <Copy aria-hidden className="size-4" />}
    </button>
  );
}
