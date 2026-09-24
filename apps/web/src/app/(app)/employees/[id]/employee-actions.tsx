'use client';

import type { EmployeeDetail } from '@ems/contracts';
import { LoaderCircle, RotateCcw, Trash2, UserX } from 'lucide-react';
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
import { api } from '@/lib/api-client';
import { ApiRequestError } from '@/lib/api-error';

type Action = 'deactivate' | 'reactivate' | 'delete';

const COPY: Record<Action, { title: string; body: (name: string) => string; confirm: string; done: (name: string) => string }> = {
  deactivate: {
    title: 'Deactivate this employee?',
    body: (name) =>
      `${name} will be signed out everywhere and can't sign in. Any pending leave requests are cancelled and the days go back to their balance. You can reactivate them later.`,
    confirm: 'Deactivate',
    done: (name) => `${name} was deactivated`,
  },
  reactivate: {
    title: 'Reactivate this employee?',
    body: (name) => `${name} becomes active again and, if they have an account, can sign in.`,
    confirm: 'Reactivate',
    done: (name) => `${name} was reactivated`,
  },
  delete: {
    title: 'Delete this employee record?',
    body: (name) =>
      `${name} disappears from lists and searches, their account is disabled, and their ID can be reused. The audit history is kept.`,
    confirm: 'Delete record',
    done: (name) => `${name}'s record was deleted`,
  },
};

export function EmployeeActions({ employee }: { employee: Pick<EmployeeDetail, 'id' | 'fullName' | 'allowedActions'> }) {
  const router = useRouter();
  const [open, setOpen] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: Action) {
    setPending(true);
    try {
      if (action === 'delete') await api(`/employees/${employee.id}`, { method: 'DELETE' });
      else await api(`/employees/${employee.id}/${action}`, { method: 'POST' });
      toast.success(COPY[action].done(employee.fullName));
      setOpen(null);
      if (action === 'delete') router.replace('/employees');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Something went wrong. Try again.');
    } finally {
      setPending(false);
    }
  }

  const { allowedActions: allowed } = employee;
  if (!allowed.deactivate && !allowed.reactivate && !allowed.delete) return null;

  return (
    <>
      {allowed.deactivate && (
        <Button variant="outline" className="h-10" onClick={() => setOpen('deactivate')}>
          <UserX aria-hidden /> Deactivate
        </Button>
      )}
      {allowed.reactivate && (
        <Button variant="outline" className="h-10" onClick={() => setOpen('reactivate')}>
          <RotateCcw aria-hidden /> Reactivate
        </Button>
      )}
      {allowed.delete && (
        <Button variant="outline" className="h-10 text-danger-text hover:text-danger-text" onClick={() => setOpen('delete')}>
          <Trash2 aria-hidden /> Delete
        </Button>
      )}

      <AlertDialog open={open !== null} onOpenChange={(next) => !pending && !next && setOpen(null)}>
        {open && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{COPY[open].title}</AlertDialogTitle>
              <AlertDialogDescription>{COPY[open].body(employee.fullName)}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              {/* A plain button, so the dialog stays open (and shows progress) until the request finishes */}
              <Button variant={open === 'reactivate' ? 'default' : 'destructive'} disabled={pending} onClick={() => void run(open)}>
                {pending && <LoaderCircle className="animate-spin" aria-hidden />}
                {COPY[open].confirm}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  );
}
