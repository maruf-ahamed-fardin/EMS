'use client';

import type { TeamProfileDetail } from '@ems/contracts';
import { Check, Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { buildVCard, vCardFileName } from '@/lib/vcard';

/**
 * The card's two actions. Both are client-side on purpose: a vCard is built from what is already
 * on the page, so saving a contact needs no extra request and works the moment the card renders.
 */
export function SaveContactButton(
  props: { variant: 'copy'; value: string; label: string } | { variant: 'vcard'; card: TeamProfileDetail },
) {
  const [done, setDone] = useState(false);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      // Denied clipboard permission, or an insecure origin: say so rather than fail silently
      toast.error('Could not copy. Select the text and copy it instead.');
    }
  }

  if (props.variant === 'copy') {
    return (
      <button
        type="button"
        onClick={() => void copy(props.value)}
        aria-label={props.label}
        className="grid size-9 shrink-0 place-items-center rounded-xl border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {done ? <Check aria-hidden className="size-4 text-success-text" /> : <Copy aria-hidden className="size-4" />}
      </button>
    );
  }

  // Bound here, not read inside download(): a parameter's narrowing does not survive a closure
  const card = props.card;

  function download() {
    const blob = new Blob([buildVCard(card)], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = vCardFileName(card);
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`${card.fullName} saved as a contact file.`);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex h-12 flex-1 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-primary via-[#7b3fe4] to-[#d9481f] px-5 font-bold text-white shadow-lg shadow-primary/25 transition-transform hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <Download aria-hidden className="size-4" />
      Save contact
    </button>
  );
}
