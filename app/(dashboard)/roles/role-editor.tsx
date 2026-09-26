'use client';

import type { PermissionItem, PermissionKey, PermissionMap, PermissionScope, RoleItem } from '@/lib/validations';
import { LoaderCircle, Lock, RotateCcw, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/client/api-client';
import { ApiRequestError } from '@/lib/client/api-error';
import { cn } from '@/lib/utils/cn';

const NONE = 'NONE';
export const SCOPE_LABELS: Record<PermissionScope | typeof NONE, string> = { NONE: 'No access', OWN: 'Own', TEAM: 'Team', ALL: 'Everyone' };

/** Which permissions differ between two grant maps. */
export function changedKeys(a: PermissionMap, b: PermissionMap): PermissionKey[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k as PermissionKey] !== b[k as PermissionKey]) as PermissionKey[];
}

/** Only a Super Admin grants or removes user and role management (the API refuses anyone else). */
const ADMIN_PERMISSIONS = new Set(['user.manage', 'role.manage']);

/**
 * One role's grants as a list per module, each with its reach. Changes are saved together, so a role
 * is never left half-edited.
 */
export function RoleEditor({ role, catalogue, canGrantAdmin }: { role: RoleItem; catalogue: PermissionItem[]; canGrantAdmin: boolean }) {
  const router = useRouter();
  const [grants, setGrants] = useState<PermissionMap>(role.permissions);
  const [pending, setPending] = useState(false);
  const changed = changedKeys(role.permissions, grants);
  const modules = useMemo(() => {
    const groups = new Map<string, PermissionItem[]>();
    for (const p of catalogue) groups.set(p.module, [...(groups.get(p.module) ?? []), p]);
    return [...groups];
  }, [catalogue]);

  async function save() {
    setPending(true);
    try {
      await api(`/roles/${role.id}/permissions`, { method: 'PUT', body: { permissions: grants } });
      toast.success(`${role.name}: ${changed.length} ${changed.length === 1 ? 'permission' : 'permissions'} changed. It applies on everyone’s next click.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not save. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {!role.editable && (
        <p className="flex items-center gap-2 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="size-4" aria-hidden />
          {role.key === 'super_admin'
            ? 'Super Admin always has every permission, so nobody can be locked out of administration.'
            : 'This is your own role. Another administrator changes it, so nobody raises their own permissions.'}
        </p>
      )}
      {modules.map(([module, permissions]) => (
        <section key={module} className="overflow-hidden rounded-2xl border bg-card shadow-panel" aria-labelledby={`module-${module}`}>
          <h2 id={`module-${module}`} className="border-b px-4 py-3 text-sm font-semibold capitalize md:px-5">
            {module.replaceAll('_', ' ')}
          </h2>
          <ul className="divide-y">
            {permissions.map((p) => {
              const value = grants[p.key] ?? NONE;
              const edited = changed.includes(p.key);
              return (
                <li key={p.key} className={cn('flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-5', edited && 'bg-accent/40')}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.description}</p>
                    <p className="font-mono text-xs text-muted-foreground">{p.key}</p>
                  </div>
                  <Select
                    value={value}
                    disabled={!role.editable || pending || (ADMIN_PERMISSIONS.has(p.key) && !canGrantAdmin)}
                    onValueChange={(v) =>
                      setGrants((current) => {
                        const next = { ...current };
                        if (v === NONE) delete next[p.key];
                        else next[p.key] = v as PermissionScope;
                        return next;
                      })
                    }
                  >
                    <SelectTrigger className="h-9 w-full sm:w-36" aria-label={`${p.description} for ${role.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SCOPE_LABELS) as Array<keyof typeof SCOPE_LABELS>).map((scope) => (
                        <SelectItem key={scope} value={scope}>
                          {SCOPE_LABELS[scope]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {role.editable && (
        <div className="sticky bottom-4 flex flex-wrap items-center justify-end gap-2 rounded-2xl border bg-card/95 p-3 shadow-panel backdrop-blur">
          <p className="mr-auto text-sm text-muted-foreground" aria-live="polite">
            {changed.length === 0 ? 'No changes' : `${changed.length} ${changed.length === 1 ? 'change' : 'changes'} not saved`}
          </p>
          <Button variant="ghost" onClick={() => setGrants(role.permissions)} disabled={pending || changed.length === 0}>
            <RotateCcw aria-hidden /> Undo
          </Button>
          <Button onClick={() => void save()} disabled={pending || changed.length === 0}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Save aria-hidden />} Save {role.name}
          </Button>
        </div>
      )}
    </div>
  );
}
