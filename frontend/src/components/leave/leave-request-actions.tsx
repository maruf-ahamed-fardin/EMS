'use client';

import type { LeaveRequestItem } from '@ems/contracts';
import { Ban, Check, LoaderCircle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { ApiRequestError } from '@/lib/api-error';
import { daysLabel, formatLeaveRange } from '@/lib/leave';

type Action = 'approve' | 'reject' | 'cancel';

/** Approve, reject (with a required reason) or cancel, as the API allows for this viewer. */
export function LeaveRequestActions({ request, compact = false }: { request: LeaveRequestItem; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<Action | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { allowedActions: allowed } = request;

  async function run(action: Action) {
    if (action === 'reject' && note.trim().length < 3) {
      setError('Tell them why it was rejected');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api(`/leave/requests/${request.id}/${action}`, { method: 'PATCH', body: action === 'cancel' ? {} : { note: note.trim() || undefined } });
      const who = request.employee.name;
      toast.success(action === 'approve' ? `Leave approved for ${who}` : action === 'reject' ? `Leave rejected for ${who}` : 'Leave cancelled');
      setOpen(null);
      setNote('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setPending(false);
    }
  }

  if (!allowed.approve && !allowed.reject && !allowed.cancel) return null;
  const size = compact ? 'sm' : 'default';

  return (
    <div className="flex flex-wrap gap-2">
      {allowed.approve && (
        <Button size={size} className={compact ? 'h-9' : 'h-10'} onClick={() => setOpen('approve')}>
          <Check aria-hidden /> Approve
        </Button>
      )}
      {allowed.reject && (
        <Button size={size} variant="outline" className={compact ? 'h-9' : 'h-10'} onClick={() => setOpen('reject')}>
          <X aria-hidden /> Reject
        </Button>
      )}
      {allowed.cancel && (
        <Button size={size} variant="ghost" className={compact ? 'h-9' : 'h-10'} onClick={() => setOpen('cancel')}>
          <Ban aria-hidden /> Cancel request
        </Button>
      )}

      <AlertDialog open={open !== null} onOpenChange={(next) => !pending && !next && (setOpen(null), setError(null))}>
        {open && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {open === 'approve' ? 'Approve this leave?' : open === 'reject' ? 'Reject this leave?' : 'Cancel this leave?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {request.employee.name} · {request.leaveType.name} · {formatLeaveRange(request.startDate, request.endDate)} · {daysLabel(request.days)}
                {open === 'approve' && ' The days move from waiting to used, and any recorded attendance on those days becomes leave.'}
                {open === 'cancel' && ' The days go back to the balance.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {open !== 'cancel' && (
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="leave-note">{open === 'reject' ? 'Reason (shown to them)' : 'Note (optional)'}</Label>
                <Textarea id="leave-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={error ? true : undefined} />
                {error && <p className="text-sm text-danger-text">{error}</p>}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Back</AlertDialogCancel>
              <Button variant={open === 'approve' ? 'default' : 'destructive'} disabled={pending} onClick={() => void run(open)}>
                {pending && <LoaderCircle className="animate-spin" aria-hidden />}
                {open === 'approve' ? 'Approve' : open === 'reject' ? 'Reject' : 'Cancel leave'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
