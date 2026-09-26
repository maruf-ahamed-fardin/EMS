import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/constants';
import { localLoginEnabled } from '@/lib/client/local-auth';
import { getSession } from '@/lib/auth/session';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getSession()) redirect(next);

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Use your work email and password.</p>
      <LoginForm next={next} passwordWasReset={params.reset === '1'} local={localLoginEnabled()} />
    </>
  );
}
