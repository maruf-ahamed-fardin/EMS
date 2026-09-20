'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type DataResponse, FORGOT_PASSWORD_MESSAGE, type ForgotPasswordInput, forgotPasswordInput } from '@ems/contracts';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormAlert } from '@/components/forms/form-alert';
import { TextField } from '@/components/forms/text-field';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { applyApiError } from '@/lib/form-errors';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordInput), defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const response = await api<DataResponse<{ message: string }>>('/auth/forgot-password', { method: 'POST', body: values });
      setSent(response.data.message);
    } catch (error) {
      setFormError(applyApiError(error, setError, ['email']));
    }
  });

  return (
    <>
      <title>Reset your password · SeloraX EMS</title>
      <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
      <p className="mt-1 text-sm text-muted-foreground">Enter your work email and we&rsquo;ll send you a link.</p>

      {sent ? (
        <div className="mt-8 flex flex-col gap-4">
          <FormAlert tone="success">{sent || FORGOT_PASSWORD_MESSAGE}</FormAlert>
          <p className="text-sm text-muted-foreground">Nothing arrived? Check your spam folder, or ask HR to confirm the email on your account.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-4">
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
          <Button type="submit" size="lg" className="h-11" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}

      <Link href="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Back to sign in
      </Link>
    </>
  );
}
