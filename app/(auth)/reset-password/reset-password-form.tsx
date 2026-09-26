'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { newPassword, PASSWORD_MIN_LENGTH } from '@/lib/validations';
import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert } from '@/components/forms/form-alert';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/client/api-client';
import { applyApiError } from '@/lib/client/form-errors';

const schema = z
  .object({ password: newPassword, confirm: z.string() })
  .refine((value) => value.password === value.confirm, { path: ['confirm'], message: 'The passwords don’t match' });
type Values = z.infer<typeof schema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password } });
    } catch (error) {
      setFormError(applyApiError(error, setError, ['password']));
      return;
    }
    router.replace('/login?reset=1');
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-4">
      {formError && (
        <FormAlert tone="error">
          {formError}{' '}
          {formError.includes('expired') && (
            <Link href="/forgot-password" className="font-semibold underline">
              Request a new link
            </Link>
          )}
        </FormAlert>
      )}
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        autoFocus
        required
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. A few unrelated words work well.`}
        registration={register('password')}
        error={errors.password}
      />
      <TextField
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        registration={register('confirm')}
        error={errors.confirm}
      />
      <Button type="submit" size="lg" className="h-11" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
        {isSubmitting ? 'Saving…' : 'Set new password'}
      </Button>
    </form>
  );
}
