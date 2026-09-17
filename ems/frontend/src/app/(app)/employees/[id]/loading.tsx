import { Skeleton } from '@/components/ui/skeleton';

export default function EmployeeLoading() {
  return (
    <div aria-busy="true" aria-label="Loading employee">
      <Skeleton className="mb-4 h-4 w-48" />
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full md:size-20" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-5 w-32" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      </div>
      <Skeleton className="mt-6 h-9 w-80 max-w-full" />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    </div>
  );
}
