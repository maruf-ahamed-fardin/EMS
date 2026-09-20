import { BrandMark } from '@/components/shell/brand-mark';

// Auth pages read cookies and search params; never render them statically
export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
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
          {children}
        </div>
      </section>
    </main>
  );
}
