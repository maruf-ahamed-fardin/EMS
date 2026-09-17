import type { Metadata } from 'next';
import Link from 'next/link';
import { FormAlert } from '@/components/forms/form-alert';
import { ResetPasswordForm } from './reset-password-form';

export const metadata: Metadata = {
  title: 'Choose a new password',
  // The token is in this page's URL: never send it to another site as a referrer
  referrer: 'no-referrer',
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">You&rsquo;ll be signed out on every device, then sign in again.</p>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          <FormAlert tone="error">This link is incomplete. Open the link from your email again, or request a new one.</FormAlert>
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Request a new link
          </Link>
        </div>
      )}
    </>
  );
}
