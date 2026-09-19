/**
 * Fields each entity may write into `audit_logs.before/after` (plan §8). Anything not listed is
 * dropped, so a new column never lands in the audit log by accident. Entities join this list as
 * their modules are built.
 */
export const AUDIT_FIELDS: Record<string, readonly string[]> = {
  user: ['email', 'status', 'roleId', 'employeeId', 'lockedUntil', 'reason', 'sessionsRevoked'],
  employee: [
    'employeeCode', 'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'gender', 'address', 'emergencyContact',
    'departmentId', 'positionId', 'managerId', 'joiningDate', 'employmentType', 'status', 'workLocation',
    'deactivatedAt', 'deletedAt', 'leaveRequestsCancelled', 'sessionsRevoked', 'accountCreated',
  ],
  role: ['key', 'name', 'description', 'permissions'],
  department: ['name', 'code', 'description', 'headEmployeeId', 'isActive', 'deletedAt', 'positionsDeleted'],
  position: ['title', 'departmentId', 'level', 'isActive', 'deletedAt'],
  attendance: ['employeeId', 'workDate', 'firstInAt', 'lastOutAt', 'status', 'lateMinutes', 'workedMinutes', 'note', 'created'],
  setting: ['timeZone', 'weekendDays', 'workdayStart', 'graceMinutes'],
  holiday: ['date', 'name', 'attendanceRowsUpdated'],
  leave_type: ['name', 'code', 'defaultDaysPerYear', 'carryForwardMax', 'isPaid', 'requiresDocument', 'isActive'],
  leave_balance: ['employeeId', 'leaveTypeId', 'year', 'allocated', 'carriedForward', 'note'],
  leave_request: ['employeeId', 'leaveTypeId', 'startDate', 'endDate', 'days', 'status', 'note'],
  document: ['employeeId', 'documentTypeId', 'title', 'mimeType', 'sizeBytes', 'expiresAt', 'deletedAt'],
  document_type: ['name', 'code', 'isSensitive', 'hasExpiry', 'deletedAt'],
};

/** Second line of defence: keys that are never written, even if an allow-list names them. */
const NEVER_LOGGED = /password|token|secret|storagekey|photokey|hash/i;

export function auditView(entityType: string, value: Record<string, unknown> | null | undefined) {
  if (!value) return null;
  const allowed = AUDIT_FIELDS[entityType] ?? [];
  const view: Record<string, unknown> = {};
  for (const field of allowed) {
    if (field in value && !NEVER_LOGGED.test(field)) view[field] = scrub(value[field]);
  }
  return Object.keys(view).length > 0 ? view : null;
}

function scrub(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !NEVER_LOGGED.test(key))
        .map(([key, nested]) => [key, scrub(nested)]),
    );
  }
  return value;
}
