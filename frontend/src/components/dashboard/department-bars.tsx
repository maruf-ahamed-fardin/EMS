import Link from 'next/link';

/**
 * Headcount by department. Comparing magnitudes is a bar's job (dataviz form guide), so this is a
 * sorted horizontal bar list in one hue with the value labelled, not a donut.
 */
export function DepartmentBars({ departments }: { departments: Array<{ departmentId: string; name: string; count: number }> }) {
  const max = Math.max(1, ...departments.map((d) => d.count));
  if (departments.length === 0) return <p className="text-sm text-muted-foreground">No active employees yet.</p>;

  return (
    <ul className="grid grid-cols-1 gap-3">
      {departments.map((d) => (
        <li key={d.departmentId}>
          <Link href={`/departments/${d.departmentId}`} className="group block rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate group-hover:underline">{d.name}</span>
              <span className="font-semibold tabular">{d.count}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-chart-1" style={{ width: `${(d.count / max) * 100}%` }} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
