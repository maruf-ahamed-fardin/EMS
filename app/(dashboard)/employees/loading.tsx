import { Skeleton } from '@/components/ui/skeleton';

export default function EmployeesLoading() {
  return (
    <div aria-busy="true" aria-label="Loading employees">
      <Skeleton className="mb-2 h-8 w-40" />
      <Skeleton className="mb-6 h-4 w-28" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b p-4">
          <Skeleton className="h-10 w-full lg:w-80" />
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b px-5 py-3 last:border-0">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="hidden h-5 w-20 md:block" />
            <Skeleton className="hidden h-5 w-16 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
