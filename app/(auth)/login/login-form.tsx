'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginInput } from '@/lib/validations';
import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/forms/form-alert';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/client/api-client';
import { applyApiError } from '@/lib/client/form-errors';
import { localSignIn } from '@/lib/client/local-auth-actions';

/** `local`: sign in on this server (LOGIN_EMAIL / LOGIN_PASSWORD) instead of the API, with no password reset. */
export function LoginForm({ next, passwordWasReset, local = false }: { next: string; passwordWasReset: boolean; local?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginInput), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (local) {
      const error = await localSignIn(values);
      if (error) {
        setFormError(error);
        return;
      }
    } else {
      try {
        await api('/auth/login', { method: 'POST', body: values });
      } catch (error) {
        setFormError(applyApiError(error, setError, ['email', 'password']));
        return;
      }
    }
    // A fresh start for the new person, whatever the last one left in this tab
    queryClient.clear();
    router.replace(next);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-4">
      {passwordWasReset && !formError && <FormAlert tone="success">Your password was changed. Sign in with the new one.</FormAlert>}
      {formError && <FormAlert tone="error">{formError}</FormAlert>}

      <TextField
        label="Work email"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoFocus
        required
        registration={register('email')}
        error={errors.email}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        registration={register('password')}
        error={errors.password}
      />

      {!local && (
        <div className="-mt-1 flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
      )}

      <Button type="submit" size="lg" className="h-11" disabled={isSubmitting}>
        {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
