'use client';

import { LoaderCircle, Trash2 } from 'lucide-react';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { api } from '@/lib/api-client';
import { ApiRequestError } from '@/lib/api-error';

/**
 * Delete with a confirmation. When `blockedReason` is set the button stays visible but disabled and
 * explains why, instead of letting the user discover the rule through an error.
 */
export function DeleteButton({
  path,
  title,
  description,
  successMessage,
  redirectTo,
  blockedReason,
  label = 'Delete',
  size = 'default',
}: {
  path: string;
  title: string;
  description: string;
  successMessage: string;
  redirectTo?: string;
  blockedReason?: string;
  label?: string;
  size?: 'default' | 'icon';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      await api(path, { method: 'DELETE' });
      toast.success(successMessage);
      setOpen(false);
      if (redirectTo) router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Something went wrong. Try again.');
    } finally {
      setPending(false);
    }
  }

  const trigger =
    size === 'icon' ? (
      <Button variant="ghost" size="icon" className="size-9 text-danger-text hover:text-danger-text" disabled={!!blockedReason} aria-label={label}>
        <Trash2 aria-hidden />
      </Button>
    ) : (
      <Button variant="outline" className="h-10 text-danger-text hover:text-danger-text" disabled={!!blockedReason}>
        <Trash2 aria-hidden /> {label}
      </Button>
    );

  if (blockedReason) {
    return (
      <Tooltip>
        {/* A disabled button fires no pointer events; the span carries the tooltip */}
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" aria-label={`${label}: ${blockedReason}`}>
            {trigger}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{blockedReason}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={() => void confirm()}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden />}
            {label}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
