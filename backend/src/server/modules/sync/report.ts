import type { SyncAction, SyncIssue, SyncPlan } from './plan';

// Human-readable dry-run report. Names changed fields but never prints contact details.

function describe(action: SyncAction): string {
  switch (action.type) {
    case 'create': {
      const { username, hrEmployeeId } = action.fields;
      const extras = [action.profile && 'profile', action.avatar && `${action.avatar.kind} photo`].filter(Boolean);
      return `+ ${username}${hrEmployeeId ? ` (${hrEmployeeId})` : ''}${extras.length ? ` with ${extras.join(' and ')}` : ''}`;
    }
    case 'update': {
      const { username: newUsername, ...rest } = action.changes;
      const parts = [
        ...(newUsername !== undefined ? [`renamed to ${newUsername}`] : []),
        ...Object.keys(rest),
        ...(action.reactivate ? ['reactivated'] : []),
      ];
      return `~ ${action.username}: ${parts.join(', ')}`;
    }
    case 'profile':
      return `~ ${action.username} profile: ${action.changed.join(', ')}`;
    case 'avatar':
      return `~ ${action.username} photo: ${action.avatar ? `now ${action.avatar.kind}` : 'removed'}`;
    case 'deactivate':
      return `- ${action.username}: no longer in HR, made inactive`;
  }
}

const issueLine = (issue: SyncIssue) => `${issue.subject}: ${issue.detail} [${issue.code}]`;

export function formatPlan(plan: SyncPlan): string {
  const { summary: s, breaker } = plan;
  const lines = [
    `HR records: ${s.hrRecords}`,
    `Members: ${s.created} new, ${s.updated} updated (${s.renamed} renamed), ${s.reactivated} reactivated, ${s.deactivated} deactivated`,
    `Copied from HR: ${s.profilesCopied} profiles, ${s.avatarsChanged} photos`,
    breaker.tripped
      ? `Circuit breaker TRIPPED: ${breaker.changed} members would change (limit ${breaker.limit}). Check the HR data; rerun with --force if it's right.`
      : `Circuit breaker: ok (${breaker.changed} changed, limit ${breaker.limit})`,
  ];
  const section = (title: string, entries: string[]) => {
    if (entries.length > 0) lines.push('', `${title} (${entries.length}):`, ...entries.map(entry => `  ${entry}`));
  };
  section('Changes', plan.actions.map(describe));
  section('Conflicts, not applied', plan.conflicts.map(issueLine));
  section('Warnings', plan.warnings.map(issueLine));
  return lines.join('\n');
}
