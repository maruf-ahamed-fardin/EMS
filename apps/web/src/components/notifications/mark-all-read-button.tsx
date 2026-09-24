'use client';

import { useQueryClient } from '@tanstack/react-query';
import { CheckCheck, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { NOTIFICATION_KEYS } from './notification-list';

export function MarkAllReadButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    try {
      const { data } = await api<{ data: { updated: number } }>('/notifications/read-all', { method: 'PATCH' });
      toast.success(data.updated === 1 ? '1 notification marked as read' : `${data.updated} notifications marked as read`);
      await queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all });
      router.refresh();
    } catch {
      toast.error('Could not mark them as read. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" className="h-10" onClick={() => void run()} disabled={pending}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <CheckCheck aria-hidden />} Mark all read
    </Button>
  );
}
