'use client';

import { Download, LoaderCircle, Nfc, QrCode as QrIcon, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cardUrl } from '@/lib/client/qr';
import { useBrowserValue } from '@/lib/client/use-browser';
import { cn } from '@/lib/client/utils';
import { buildVCard, type VCardSource, vCardFileName } from '@/lib/client/vcard';
import { nfcSupported, writeCardTag } from '@/lib/client/web-nfc';
import { QrCode, qrPngBlob } from './qr-code';

const readOrigin = () => window.location.origin;

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadVCard(card: VCardSource) {
  saveBlob(new Blob([buildVCard(card)], { type: 'text/vcard;charset=utf-8' }), vCardFileName(card));
  toast.success(`${card.fullName} saved as a contact file.`);
}

/** The label under each action on the grid card; the full card shows the same four actions. */
function Action({
  icon: Icon,
  label,
  onClick,
  hint,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-label={hint}
      className="flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Icon aria-hidden className="size-[18px]" />
      {label}
    </button>
  );
}

type Panel = 'qr' | 'nfc' | null;

/**
 * Save contact, QR code, NFC tag (on phones that have it) and share, for one card. Everything is built in the browser from
 * what the card already shows, so none of it makes a request or reveals more than the card does.
 */
export function CardActions({ card, className }: { card: VCardSource; className?: string }) {
  const [panel, setPanel] = useState<Panel>(null);
  // NFC is only useful where a tag can be tapped: Chrome on Android. Elsewhere it is not offered.
  const nfc = useBrowserValue(nfcSupported, false);

  async function share() {
    const url = cardUrl(window.location.origin, card.employeeId);
    const data = { title: `${card.fullName} · SeloraX`, text: `${card.fullName}, ${card.position}`, url };
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(data);
      } catch {
        // Closing the share sheet rejects too; there is nothing to report
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link to the card copied.');
    } catch {
      toast.error('Could not copy the link.');
    }
  }

  return (
    <>
      <div className={cn('flex items-stretch gap-1', className)}>
        <Action icon={Download} label="Save" hint={`Save ${card.fullName} as a contact`} onClick={() => downloadVCard(card)} />
        <Action icon={QrIcon} label="QR" hint={`Show ${card.fullName}’s QR code`} onClick={() => setPanel('qr')} />
        {nfc && (
          <Action icon={Nfc} label="NFC" hint={`Write ${card.fullName}’s card to an NFC tag`} onClick={() => setPanel('nfc')} />
        )}
        <Action icon={Share2} label="Share" hint={`Share ${card.fullName}’s card`} onClick={() => void share()} />
      </div>

      <Dialog open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
        <DialogContent className="sm:max-w-sm">
          {panel === 'qr' && <QrPanel card={card} />}
          {panel === 'nfc' && <NfcPanel card={card} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function QrPanel({ card }: { card: VCardSource }) {
  const [kind, setKind] = useState<'contact' | 'link'>('contact');
  const origin = useBrowserValue(readOrigin, '');

  const value = kind === 'contact' ? buildVCard(card) : cardUrl(origin, card.employeeId);

  async function download() {
    const blob = await qrPngBlob(value);
    if (!blob) {
      toast.error('This browser could not draw the image.');
      return;
    }
    saveBlob(blob, vCardFileName(card).replace(/\.vcf$/, kind === 'contact' ? '-contact-qr.png' : '-card-qr.png'));
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{card.fullName}</DialogTitle>
        <DialogDescription>
          {kind === 'contact'
            ? 'Point a phone camera at this to save the contact. No app or sign-in needed.'
            : 'Opens this card in the EMS. The person scanning has to be signed in.'}
        </DialogDescription>
      </DialogHeader>

      <div role="radiogroup" aria-label="What the code holds" className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
        {(['contact', 'link'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={kind === option}
            onClick={() => setKind(option)}
            className={cn(
              'rounded-lg py-1.5 text-sm font-semibold transition-colors',
              kind === option ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option === 'contact' ? 'Contact' : 'Card link'}
          </button>
        ))}
      </div>

      <div className="mx-auto w-full max-w-[260px] rounded-2xl border bg-white p-3">
        {origin && <QrCode value={value} label={`QR code for ${card.fullName}`} className="block w-full" />}
      </div>

      <button
        type="button"
        onClick={() => void download()}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-[1.5px] font-bold hover:bg-secondary"
      >
        <Download aria-hidden className="size-4" />
        Download QR code
      </button>
    </>
  );
}

function NfcPanel({ card }: { card: VCardSource }) {
  const [state, setState] = useState<'idle' | 'waiting' | 'done' | 'failed'>('idle');
  const supported = useBrowserValue<boolean | null>(nfcSupported, null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  async function write() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState('waiting');
    try {
      await writeCardTag(buildVCard(card), cardUrl(window.location.origin, card.employeeId), controller.signal);
      setState('done');
      toast.success('Card written to the tag.');
    } catch (error) {
      if (controller.signal.aborted) return;
      setState('failed');
      toast.error(error instanceof Error && error.name === 'NotAllowedError' ? 'NFC permission was denied.' : 'Could not write the tag. Hold it still and try again.');
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Write to an NFC tag</DialogTitle>
        <DialogDescription>
          The tag will hold {card.fullName}’s contact and a link to this card. Tapping it with a phone offers to
          save the contact.
        </DialogDescription>
      </DialogHeader>

      <div className="grid place-items-center gap-3 rounded-2xl bg-secondary/60 py-8 text-center">
        <span
          aria-hidden
          className={cn(
            'grid size-16 place-items-center rounded-full bg-accent text-accent-foreground',
            state === 'waiting' && 'animate-pulse',
          )}
        >
          <Nfc className="size-8" />
        </span>
        <p className="px-4 text-sm text-muted-foreground" aria-live="polite">
          {supported === false
            ? 'This browser cannot write NFC tags. Use Chrome on an Android phone, or share the QR code instead.'
            : state === 'waiting'
              ? 'Hold the tag against the back of your phone…'
              : state === 'done'
                ? 'Done. The tag is ready.'
                : state === 'failed'
                  ? 'That did not work. Try again.'
                  : 'Press Write, then hold a blank or rewritable tag to your phone.'}
        </p>
      </div>

      <button
        type="button"
        disabled={supported !== true || state === 'waiting'}
        onClick={() => void write()}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {state === 'waiting' ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Nfc aria-hidden className="size-4" />}
        {state === 'done' ? 'Write another' : 'Write'}
      </button>
    </>
  );
}
