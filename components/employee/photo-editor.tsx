'use client';

import { type OwnTeamProfile, PHOTO_CONTENT_TYPES, PHOTO_FIELD, PHOTO_SIZE_PX } from '@/lib/validations';
import { Camera, LoaderCircle, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, apiUpload } from '@/lib/client/api-client';
import { ApiRequestError } from '@/lib/client/api-error';
import { clamp, type CropState, initialCrop, sourceRect, zoomTo } from '@/lib/client/photo-crop';
import { ProfileAvatar } from '@/components/employee/profile-avatar';

/** The crop square on screen, in CSS pixels: fits inside the dialog on a 320 px phone. */
const VIEW = 256;
/** Anything bigger is refused before it is decoded; the upload itself is the small cropped square. */
const SOURCE_MAX_BYTES = 20 * 1024 * 1024;

/**
 * Change or remove the card photo. The chosen file is cropped to a square here and re-encoded to a
 * small WebP (JPEG where the browser cannot write WebP). That keeps uploads tiny and drops the
 * camera's metadata, such as where the photo was taken, before anything leaves the device.
 */
export function PhotoEditor({ photoUrl, initials }: { photoUrl: string | null; initials: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [removing, setRemoving] = useState(false);

  async function choose(file: File | undefined) {
    if (input.current) input.current.value = ''; // choosing the same file again still fires
    if (!file) return;
    if (!(PHOTO_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Choose a JPEG, PNG or WebP photo.');
      return;
    }
    if (file.size > SOURCE_MAX_BYTES) {
      toast.error('That photo is over 20 MB. Choose a smaller one.');
      return;
    }
    try {
      setImage(await createImageBitmap(file));
    } catch {
      toast.error('That file could not be opened as a photo.');
    }
  }

  async function remove() {
    setRemoving(true);
    try {
      await api<{ data: OwnTeamProfile }>('/team-profile/me/photo', { method: 'DELETE' });
      toast.success('Photo removed');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not remove the photo.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-panel sm:p-5 md:p-6" aria-labelledby="photo-heading">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <ProfileAvatar initials={initials} photoUrl={photoUrl} size="md" />
        <div className="min-w-0 flex-1">
          <h2 id="photo-heading" className="text-lg font-semibold">
            Photo
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A clear photo of your face helps colleagues recognise you. JPEG, PNG or WebP.
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button type="button" className="h-10 flex-1 sm:flex-none" onClick={() => input.current?.click()}>
            <Camera aria-hidden />
            {photoUrl ? 'Change' : 'Upload photo'}
          </Button>
          {photoUrl && (
            <Button type="button" variant="outline" className="h-10 flex-1 sm:flex-none" disabled={removing} onClick={() => void remove()}>
              {removing ? <LoaderCircle aria-hidden className="animate-spin" /> : <Trash2 aria-hidden />}
              Remove
            </Button>
          )}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept={PHOTO_CONTENT_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => void choose(event.target.files?.[0])}
      />

      <Dialog
        open={image !== null}
        onOpenChange={(open) => {
          if (!open) {
            image?.close();
            setImage(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          {image && (
            <Cropper
              image={image}
              onDone={() => {
                image.close();
                setImage(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Cropper({ image, onDone }: { image: ImageBitmap; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [crop, setCrop] = useState<CropState>(() => initialCrop(image.width, image.height, VIEW));
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ pointer: number; x: number; y: number } | null>(null);

  const move = useCallback(
    (dx: number, dy: number) => setCrop((state) => clamp({ ...state, x: state.x + dx, y: state.y + dy }, image.width, image.height, VIEW)),
    [image],
  );

  // Draw the preview at the screen's real pixel density, so it is sharp on a phone
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = VIEW * ratio;
    element.height = VIEW * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, VIEW, VIEW);
    context.drawImage(image, crop.x, crop.y, image.width * crop.scale, image.height * crop.scale);
  }, [image, crop]);

  async function save() {
    setSaving(true);
    try {
      const out = document.createElement('canvas');
      out.width = out.height = PHOTO_SIZE_PX;
      const context = out.getContext('2d');
      if (!context) throw new Error('canvas');
      context.imageSmoothingQuality = 'high';
      const { sx, sy, size } = sourceRect(crop, VIEW);
      context.drawImage(image, sx, sy, size, size, 0, 0, PHOTO_SIZE_PX, PHOTO_SIZE_PX);

      const encode = (type: string) => new Promise<Blob | null>((resolve) => out.toBlob(resolve, type, 0.88));
      // Safari could not write WebP until recently; it returns a PNG instead, so check and fall back
      let blob = await encode('image/webp');
      if (!blob || blob.type !== 'image/webp') blob = await encode('image/jpeg');
      if (!blob) throw new Error('encode');

      const form = new FormData();
      form.append(PHOTO_FIELD, blob, blob.type === 'image/webp' ? 'photo.webp' : 'photo.jpg');
      await apiUpload<{ data: OwnTeamProfile }>('/team-profile/me/photo', form);
      toast.success('Photo updated');
      onDone();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not save the photo. Try again.');
      setSaving(false);
    }
  }

  function setZoomLevel(next: number) {
    const value = Math.min(3, Math.max(1, next));
    setZoom(value);
    setCrop((state) => zoomTo(state, value, image.width, image.height, VIEW));
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Position your photo</DialogTitle>
        <DialogDescription>Drag to move it, and zoom so your face fills the circle.</DialogDescription>
      </DialogHeader>

      <div className="mx-auto">
        <div
          className="relative touch-none overflow-hidden rounded-2xl bg-secondary select-none"
          style={{ width: VIEW, height: VIEW }}
        >
          <canvas
            ref={canvas}
            tabIndex={0}
            role="img"
            aria-label="Photo crop. Use the arrow keys to move it."
            className="block cursor-grab focus-visible:outline-none active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY };
            }}
            onPointerMove={(event) => {
              const last = drag.current;
              if (!last || last.pointer !== event.pointerId) return;
              move(event.clientX - last.x, event.clientY - last.y);
              drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY };
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={(event) => setZoomLevel(zoom - event.deltaY * 0.002)}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 20 : 5;
              const moves: Record<string, [number, number]> = {
                ArrowLeft: [step, 0],
                ArrowRight: [-step, 0],
                ArrowUp: [0, step],
                ArrowDown: [0, -step],
              };
              const delta = moves[event.key];
              if (!delta) return;
              event.preventDefault();
              move(...delta);
            }}
          />
          {/* The circle the card will show; the corners are dimmed */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(16,19,40,0.55)] ring-2 ring-white/90"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setZoomLevel(zoom - 0.25)}
          aria-label="Zoom out"
          className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ZoomOut aria-hidden className="size-4" />
        </button>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(event) => setZoomLevel(Number(event.target.value))}
          aria-label="Zoom"
          className="h-2 flex-1 cursor-pointer accent-primary"
        />
        <button
          type="button"
          onClick={() => setZoomLevel(zoom + 0.25)}
          aria-label="Zoom in"
          className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <ZoomIn aria-hidden className="size-4" />
        </button>
      </div>

      <DialogFooter>
        <Button type="button" className="h-11 w-full sm:h-9 sm:w-auto" disabled={saving} onClick={() => void save()}>
          {saving && <LoaderCircle aria-hidden className="animate-spin" />}
          Save photo
        </Button>
      </DialogFooter>
    </>
  );
}
