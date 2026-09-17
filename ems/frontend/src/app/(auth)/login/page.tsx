import { SYSTEM_ROLES, type SystemRoleKey } from '@ems/contracts';
import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BrandMark } from '@/components/shell/brand-mark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { safeNextPath } from '@/lib/auth-paths';
import { PREVIEW_ENABLED } from '@/lib/preview-session';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  if (await getSession()) redirect(next);

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section
        aria-hidden
        className="relative hidden overflow-hidden bg-[#0b0d15] p-12 text-white lg:flex lg:flex-col lg:justify-between"
      >
        <div
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              'radial-gradient(60% 90% at 0% 0%, rgba(123,108,255,.35), transparent 60%), radial-gradient(50% 80% at 100% 0%, rgba(53,200,240,.22), transparent 60%), radial-gradient(40% 60% at 60% 100%, rgba(209,139,255,.14), transparent 70%)',
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <BrandMark />
          <span className="font-bold">SeloraX People</span>
        </div>
        <div className="relative max-w-md">
          <p className="text-3xl leading-tight font-bold text-balance">
            Your team, their time off and every record, in one place.
          </p>
          <p className="mt-4 text-white/70">Attendance, leave, documents and reports for everyone at SeloraX.</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark />
            <span className="font-bold">SeloraX People</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use your work email and password.</p>

          {/* Wired to POST /api/v1/auth/login in Phase 2 */}
          <form className="mt-8 flex flex-col gap-4" aria-describedby="login-status">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" name="email" type="email" autoComplete="username" required disabled className="h-11" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled
                className="h-11"
              />
            </div>
            <Button type="submit" size="lg" className="h-11" disabled>
              Sign in
            </Button>
            <p id="login-status" className="text-sm text-muted-foreground">
              Sign-in is being built (Phase 2).
            </p>
          </form>

          {PREVIEW_ENABLED && <PreviewSignIn next={next} />}
        </div>
      </section>
    </main>
  );
}

function PreviewSignIn({ next }: { next: string }) {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-warning/50 bg-warning/5 p-4">
      <p className="text-sm font-semibold">Development preview</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Open the app shell as one of the default roles. Only available outside production.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(Object.keys(SYSTEM_ROLES) as SystemRoleKey[]).map((role) => (
          <Button key={role} asChild variant="outline" size="sm" className="h-10 justify-between">
            <a href={`/preview-session?role=${role}&next=${encodeURIComponent(next)}`}>
              {SYSTEM_ROLES[role].name}
              <ArrowRight aria-hidden />
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}
