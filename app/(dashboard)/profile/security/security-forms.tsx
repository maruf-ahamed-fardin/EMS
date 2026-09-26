'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordInput, type DataResponse, PASSWORD_MIN_LENGTH } from '@/lib/validations';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormAlert } from '@/components/forms/form-alert';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/client/api-client';
import { applyApiError } from '@/lib/client/form-errors';

const schema = changePasswordInput.and(z.object({ confirm: z.string() })).refine((v) => v.newPassword === v.confirm, {
  path: ['confirm'],
  message: 'The passwords don’t match',
});
type Values = z.infer<typeof schema>;

export function ChangePasswordCard() {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFormError(null);
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    } catch (error) {
      setFormError(applyApiError(error, setError, ['currentPassword', 'newPassword']));
      return;
    }
    reset();
    toast.success('Password changed. Your other devices were signed out.');
  });

  return (
    <Card className="rounded-2xl shadow-panel">
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Changing it signs you out on every other device.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {formError && <FormAlert tone="error">{formError}</FormAlert>}
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
            registration={register('currentPassword')}
            error={errors.currentPassword}
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
            registration={register('newPassword')}
            error={errors.newPassword}
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            registration={register('confirm')}
            error={errors.confirm}
          />
          <div>
            <Button type="submit" className="h-11" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
              {isSubmitting ? 'Saving…' : 'Change password'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function SignOutOthersCard() {
  const [pending, setPending] = useState(false);

  async function signOutOthers() {
    setPending(true);
    try {
      const { data } = await api<DataResponse<{ sessionsRevoked: number }>>('/auth/logout-others', { method: 'POST' });
      toast.success(
        data.sessionsRevoked === 0
          ? 'You weren’t signed in anywhere else.'
          : `Signed out of ${data.sessionsRevoked} other ${data.sessionsRevoked === 1 ? 'session' : 'sessions'}.`,
      );
    } catch {
      toast.error('Couldn’t sign out other devices. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="rounded-2xl shadow-panel">
      <CardHeader>
        <CardTitle>Other devices</CardTitle>
        <CardDescription>Signed in on a shared or lost device? End every session except this one.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" className="h-11" onClick={signOutOthers} disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          Sign out other devices
        </Button>
      </CardContent>
    </Card>
  );
}
