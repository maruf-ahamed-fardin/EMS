'use client';

import type { AttendanceTrend, AttendanceTrendPoint, DataResponse, TrendRange } from '@ems/contracts';
import { LoaderCircle, Table2 } from 'lucide-react';
import { useState } from 'react';
import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const RANGES: Array<{ value: TrendRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/**
 * Checked-in and on-time counts over time. Two series (validated palette, --chart-1/--chart-2), a
 * dashed context line for how many were expected, a crosshair tooltip, a legend, direct labels on
 * the last point, and a table view for anyone who can't read the chart.
 */
export function AttendanceTrendChart({ initial }: { initial: AttendanceTrend }) {
  const [trend, setTrend] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [asTable, setAsTable] = useState(false);

  async function show(range: TrendRange) {
    if (range === trend.range) return;
    setLoading(true);
    setFailed(false);
    try {
      setTrend((await api<DataResponse<AttendanceTrend>>(`/dashboard/attendance-trend?range=${range}`)).data);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const lastIndex = trend.points.length - 1;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ul className="flex items-center gap-4 text-sm" aria-label="Legend">
          <li className="flex items-center gap-2">
            <span aria-hidden className="h-0.5 w-4 rounded-full bg-chart-1" /> Checked in
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className="h-0.5 w-4 rounded-full bg-chart-2" /> On time
          </li>
          <li className="flex items-center gap-2 text-muted-foreground">
            <span aria-hidden className="w-4 border-t-2 border-dashed border-chart-context" /> Expected
          </li>
        </ul>
        <div className="flex items-center gap-2">
          {loading && <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />}
          <div role="group" aria-label="Time range" className="inline-flex rounded-lg border p-0.5">
            {RANGES.map((range) => (
              <button
                key={range.value}
                type="button"
                onClick={() => void show(range.value)}
                aria-pressed={trend.range === range.value}
                className={cn(
                  'h-8 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  trend.range === range.value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} aria-label="Show as table">
            <Table2 aria-hidden />
          </Button>
        </div>
      </div>

      {failed && <p className="mb-2 text-sm text-danger-text">Couldn&rsquo;t load that range. Try again.</p>}

      {trend.points.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No attendance recorded for this range yet.</p>
      ) : asTable ? (
        <TrendTable points={trend.points} />
      ) : (
        <div className="h-64 w-full" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend.points} margin={{ top: 8, right: 64, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} interval="preserveStartEnd" minTickGap={16} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} width={48} />
              <Tooltip cursor={{ stroke: 'var(--chart-context)', strokeWidth: 1 }} content={(props) => <TrendTooltip {...props} />} />
              <Line type="monotone" dataKey="expected" stroke="var(--chart-context)" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="present" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }} isAnimationActive={false}>
                <LabelList dataKey="present" content={(props) => <EndLabel {...props} lastIndex={lastIndex} color="var(--foreground)" />} />
              </Line>
              <Line type="monotone" dataKey="onTime" stroke="var(--chart-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }} isAnimationActive={false}>
                <LabelList dataKey="onTime" content={(props) => <EndLabel {...props} lastIndex={lastIndex} color="var(--muted-foreground)" suffix=" on time" />} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {/* Screen readers get the numbers as a table even when the chart is shown */}
      {!asTable && trend.points.length > 0 && (
        <div className="sr-only">
          <TrendTable points={trend.points} />
        </div>
      )}
    </div>
  );
}

/** Direct label on the last point only (dataviz: selective labels, text in ink colors, not series colors). */
function EndLabel(props: { x?: unknown; y?: unknown; value?: unknown; index?: number; lastIndex: number; color: string; suffix?: string }) {
  if (props.index !== props.lastIndex || props.x === undefined || props.y === undefined) return null;
  return (
    <text x={Number(props.x) + 8} y={Number(props.y)} dy={4} fill={props.color} fontSize={12} fontWeight={600}>
      {String(props.value ?? '')}
      {props.suffix}
    </text>
  );
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) {
  const point = payload?.[0]?.payload as AttendanceTrendPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-semibold">{point.key.length === 10 ? `${point.label} · ${point.key.slice(8)}/${point.key.slice(5, 7)}` : point.label}</p>
      <p className="flex items-center gap-2">
        <span aria-hidden className="h-0.5 w-3 rounded-full bg-chart-1" /> Checked in <span className="ml-auto pl-4 font-semibold tabular">{point.present}</span>
      </p>
      <p className="flex items-center gap-2">
        <span aria-hidden className="h-0.5 w-3 rounded-full bg-chart-2" /> On time <span className="ml-auto pl-4 font-semibold tabular">{point.onTime}</span>
      </p>
      <p className="flex items-center gap-2 text-muted-foreground">
        <span aria-hidden className="w-3 border-t-2 border-dashed border-chart-context" /> Expected <span className="ml-auto pl-4 font-semibold tabular">{point.expected}</span>
      </p>
    </div>
  );
}

function TrendTable({ points }: { points: AttendanceTrendPoint[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead className="text-right">Checked in</TableHead>
          <TableHead className="text-right">On time</TableHead>
          <TableHead className="text-right">Expected</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {points.map((p) => (
          <TableRow key={p.key}>
            <TableCell>{p.key.length === 10 ? `${p.label} (${p.key})` : p.label}</TableCell>
            <TableCell className="text-right tabular">{p.present}</TableCell>
            <TableCell className="text-right tabular">{p.onTime}</TableCell>
            <TableCell className="text-right tabular">{p.expected}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
