'use client';

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@ems/contracts';
import { LoaderCircle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { auditHref } from '@/lib/audit';

const ANY = '__any__';

/** Actions grouped by what they are about: "employee.updated" goes under "employee". */
const GROUPS = Object.entries(
  Object.keys(AUDIT_ACTIONS).reduce<Record<string, string[]>>((groups, action) => {
    const group = action.split('.')[0]!;
    (groups[group] ??= []).push(action);
    return groups;
  }, {}),
);
const GROUP_LABELS: Record<string, string> = { auth: 'Sign-in', ...AUDIT_ENTITY_TYPES };

/** Action, record type and dates, in the URL. Filters set by clicking (person, record) show as chips. */
export function AuditFilters({ params, actorName, entityLabel }: { params: Record<string, string | undefined>; actorName: string | null; entityLabel: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = (changes: Record<string, string | undefined>) => startTransition(() => router.replace(auditHref(params, changes), { scroll: false }));

  return (
    <div className="flex flex-col gap-3 border-b p-4" aria-busy={pending}>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs" id="audit-action-label">
            Action
          </Label>
          <Select value={params.action ?? ANY} onValueChange={(v) => go({ action: v === ANY ? undefined : v })}>
            <SelectTrigger className="h-10 w-full sm:w-64" aria-labelledby="audit-action-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any action</SelectItem>
              {GROUPS.map(([group, actions]) => (
                <SelectGroup key={group}>
                  <SelectLabel>{GROUP_LABELS[group] ?? group}</SelectLabel>
                  {actions.map((a) => (
                    <SelectItem key={a} value={a}>
                      {AUDIT_ACTIONS[a as keyof typeof AUDIT_ACTIONS]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs" id="audit-entity-label">
            Record type
          </Label>
          <Select value={params.entityType ?? ANY} onValueChange={(v) => go({ entityType: v === ANY ? undefined : v, entityId: undefined })}>
            <SelectTrigger className="h-10 w-full sm:w-48" aria-labelledby="audit-entity-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any record</SelectItem>
              {Object.entries(AUDIT_ENTITY_TYPES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-from" className="text-xs">
              From
            </Label>
            <Input id="audit-from" type="date" className="h-10" value={params.from ?? ''} max={params.to} onChange={(e) => go({ from: e.target.value || undefined })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="audit-to" className="text-xs">
              To
            </Label>
            <Input id="audit-to" type="date" className="h-10" value={params.to ?? ''} min={params.from} onChange={(e) => go({ to: e.target.value || undefined })} />
          </div>
        </div>
        {pending && <LoaderCircle className="mb-3 size-4 animate-spin text-muted-foreground" aria-label="Updating" />}
      </div>
      {(params.actorUserId || params.entityId) && (
        <div className="flex flex-wrap gap-2">
          {params.actorUserId && (
            <Button variant="secondary" size="sm" className="h-8" onClick={() => go({ actorUserId: undefined })} aria-label={`Remove filter: by ${actorName ?? 'this person'}`}>
              By {actorName ?? 'this person'} <X aria-hidden />
            </Button>
          )}
          {params.entityId && (
            <Button variant="secondary" size="sm" className="h-8" onClick={() => go({ entityId: undefined })} aria-label={`Remove filter: ${entityLabel ?? 'this record'}`}>
              {entityLabel ?? 'This record'} <X aria-hidden />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
