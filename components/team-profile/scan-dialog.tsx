'use client';

import { Camera, Copy, Download, LoaderCircle, Nfc, ScanQrCode, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cardIdFromScan, readVCard } from '@/lib/client/qr';
import { useBrowserValue } from '@/lib/client/use-browser';
import { cn } from '@/lib/client/utils';
import { nfcSupported, readTag } from '@/lib/client/web-nfc';

type Source = 'camera' | 'nfc';

/** Chrome's built-in detector where it exists; jsQR (loaded only when needed) everywhere else. */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

async function makeDecoder(): Promise<(video: HTMLVideoElement, canvas: HTMLCanvasElement) => Promise<string | null>> {
  const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector;
  if (Detector) {
    const detector = new Detector({ formats: ['qr_code'] });
    return async (video) => (await detector.detect(video))[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import('jsqr');
  return async (video, canvas) => {
    const { videoWidth: width, videoHeight: height } = video;
    if (!width || !height) return null;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    return jsQR(context.getImageData(0, 0, width, height).data, width, height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}

/**
 * Scan a colleague's card: a QR code through the camera, or an NFC tag on phones that have it.
 * A code for one of our cards opens that card. A contact code is shown, never acted on, and any
 * other text is only displayed: a scanned link from outside is not opened for the user.
 */
export function ScanDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border bg-card px-4 text-sm font-bold shadow-sm hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ScanQrCode aria-hidden className="size-[18px]" />
        Scan a card
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">{open && <Scanner onDone={() => setOpen(false)} />}</DialogContent>
      </Dialog>
    </>
  );
}

function Scanner({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const nfc = useBrowserValue(nfcSupported, false);
  const [source, setSource] = useState<Source>('camera');
  const [result, setResult] = useState<string | null>(null);

  function handle(text: string) {
    const id = cardIdFromScan(text, window.location.origin);
    if (id) {
      onDone();
      router.push(`/team-profile/${id}`);
      return;
    }
    setResult(text);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Scan a card</DialogTitle>
        <DialogDescription>
          {nfc ? 'Read a colleague’s QR code with your camera, or tap their NFC tag.' : 'Point your camera at a colleague’s QR code.'}
        </DialogDescription>
      </DialogHeader>

      {/* The NFC tab only exists where a tag can be read (Chrome on Android) */}
      {nfc && (
        <div role="tablist" aria-label="How to scan" className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
          {(
            [
              ['camera', Camera, 'QR code'],
              ['nfc', Nfc, 'NFC tag'],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={source === key}
              onClick={() => {
                setSource(key);
                setResult(null);
              }}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-lg py-1.5 text-sm font-semibold transition-colors',
                source === key ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      {result !== null ? (
        <ScanResult text={result} onAgain={() => setResult(null)} onDone={onDone} />
      ) : source === 'camera' ? (
        <CameraScanner onRead={handle} />
      ) : (
        <NfcScanner onRead={handle} />
      )}
    </>
  );
}

function CameraScanner({ onRead }: { onRead: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  // Kept in a ref so the camera effect does not restart when the parent re-renders
  const read = useRef(onRead);
  useEffect(() => {
    read.current = onRead;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot use the camera here. Camera access needs https or localhost.');
        setStarting(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      } catch (cause) {
        setError(
          cause instanceof Error && cause.name === 'NotAllowedError'
            ? 'Camera access was blocked. Allow it in the browser’s site settings and try again.'
            : 'No camera could be opened.',
        );
        setStarting(false);
        return;
      }
      if (stopped || !video.current || !canvas.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      setStarting(false);

      const decode = await makeDecoder();
      const tick = async () => {
        if (stopped || !video.current || !canvas.current) return;
        const text = await decode(video.current, canvas.current).catch(() => null);
        if (stopped) return;
        if (text) {
          read.current(text);
          return;
        }
        frame = requestAnimationFrame(() => void tick());
      };
      void tick();
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#101328]">
      <video ref={video} muted playsInline className="size-full object-cover" />
      <canvas ref={canvas} hidden />
      {/* The aiming frame */}
      <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(16,19,40,0.45)]" />
      {(starting || error) && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white" aria-live="polite">
          {error ?? (
            <span className="inline-flex items-center gap-2">
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
              Starting the camera…
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function NfcScanner({ onRead }: { onRead: (text: string) => void }) {
  const supported = useBrowserValue<boolean | null>(nfcSupported, null);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);

  async function scan() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setError(null);
    setWaiting(true);
    try {
      const text = await readTag(controller.signal);
      controller.abort(); // stop listening once one tag has been read
      onRead(text);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'That tag could not be read.');
    } finally {
      setWaiting(false);
    }
  }

  return (
    <div className="grid place-items-center gap-4 rounded-2xl bg-secondary/60 px-4 py-8 text-center">
      <span
        aria-hidden
        className={cn('grid size-16 place-items-center rounded-full bg-accent text-accent-foreground', waiting && 'animate-pulse')}
      >
        <Nfc className="size-8" />
      </span>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {supported === false
          ? 'This browser cannot read NFC tags. Use Chrome on an Android phone, or scan the QR code instead.'
          : (error ?? (waiting ? 'Hold the tag against the back of your phone…' : 'Press Start, then tap a colleague’s tag.'))}
      </p>
      <button
        type="button"
        disabled={supported !== true || waiting}
        onClick={() => void scan()}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {waiting ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <Nfc aria-hidden className="size-4" />}
        Start
      </button>
    </div>
  );
}

function ScanResult({ text, onAgain, onDone }: { text: string; onAgain: () => void; onDone: () => void }) {
  const router = useRouter();
  const contact = readVCard(text);

  function saveContact() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/vcard;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(contact?.name ?? 'contact').replace(/[^a-z0-9]+/gi, '-')}.vcf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied.');
    } catch {
      toast.error('Could not copy.');
    }
  }

  return (
    <div className="grid gap-3">
      {contact ? (
        <div className="rounded-2xl border p-4">
          <div className="font-bold">{contact.name}</div>
          {contact.email && <div className="mt-1 truncate text-sm text-muted-foreground">{contact.email}</div>}
          {contact.phone && <div className="truncate text-sm text-muted-foreground">{contact.phone}</div>}
        </div>
      ) : (
        <div className="rounded-2xl border p-4">
          <div className="text-xs font-semibold text-muted-foreground">This code is not a SeloraX card. It says:</div>
          <p className="mt-1 max-h-32 overflow-auto font-mono text-[13px] break-all">{text}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {contact ? (
          <>
            <button type="button" onClick={saveContact} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90">
              <Download aria-hidden className="size-4" />
              Save contact
            </button>
            {contact.email ? (
              <button
                type="button"
                onClick={() => {
                  onDone();
                  router.push(`/team-profile?q=${encodeURIComponent(contact.email!)}`);
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-[1.5px] font-bold hover:bg-secondary"
              >
                <Search aria-hidden className="size-4" />
                Find card
              </button>
            ) : (
              <span />
            )}
          </>
        ) : (
          <button type="button" onClick={() => void copy()} className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl border-[1.5px] font-bold hover:bg-secondary">
            <Copy aria-hidden className="size-4" />
            Copy text
          </button>
        )}
      </div>
      <button type="button" onClick={onAgain} className="text-sm font-semibold text-primary hover:underline">
        Scan another
      </button>
    </div>
  );
}
