import { Skeleton } from '@/components/ui/skeleton';

/** Page-shaped placeholder while a route's server work runs. Routes with tables add their own. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-2 h-8 w-56" />
      <Skeleton className="mb-6 h-4 w-80 max-w-full" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-4 h-72 rounded-2xl" />
    </div>
  );
}
