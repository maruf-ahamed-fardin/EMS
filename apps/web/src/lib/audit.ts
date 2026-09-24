import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@ems/contracts';

export function actionLabel(action: string): string {
  return AUDIT_ACTIONS[action as keyof typeof AUDIT_ACTIONS] ?? action;
}

export function entityTypeLabel(type: string): string {
  return AUDIT_ENTITY_TYPES[type as keyof typeof AUDIT_ENTITY_TYPES] ?? type;
}

/** Where a record lives in the app, when it has a page of its own. */
export function entityHref(type: string, id: string | null): string | null {
  if (!id) return null;
  switch (type) {
    case 'employee':
      return `/employees/${id}`;
    case 'department':
      return `/departments/${id}`;
    case 'position':
      return '/positions';
    case 'leave_type':
      return '/leave/types';
    case 'document_type':
      return '/documents/types';
    case 'setting':
    case 'holiday':
      return '/settings';
    default:
      return null;
  }
}

/** `emergencyContact` → "emergency contact", `departmentId` → "department". */
export function fieldLabel(field: string): string {
  return field
    .replace(/Id$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
}

/** A before/after value as text: nested objects become "key: value" lines, nothing becomes a dash. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length === 0 ? '—' : value.map(formatValue).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${fieldLabel(k)}: ${formatValue(v)}`)
      .join('\n');
  }
  return String(value);
}

/** The /audit-logs URL with some filters changed; a new filter goes back to page 1. */
export function auditHref(current: Record<string, string | undefined>, changes: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...changes };
  if (!('page' in changes)) delete merged.page;
  for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/audit-logs?${query}` : '/audit-logs';
}
