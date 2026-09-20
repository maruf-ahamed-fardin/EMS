import {
  can,
  type PermissionKey,
  type PermissionMap,
  type PermissionScope,
} from '@ems/contracts';
import {
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  ChartColumn,
  FileText,
  FolderCog,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Plane,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
} from 'lucide-react';

/** A grant that makes an item visible: the permission and the narrowest scope that counts. */
export type Requirement = readonly [PermissionKey, PermissionScope?];

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Visible when any one requirement is met. Omitted means every signed-in user. */
  anyOf?: readonly Requirement[];
}

export interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

/**
 * The one navigation config (plan §11). The sidebar, the mobile drawer and page titles all read it,
 * so an employee's short menu follows from their permissions with no separate list.
 */
export const NAVIGATION: readonly NavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'People',
    items: [
      { label: 'Employees', href: '/employees', icon: Users, anyOf: [['employee.view', 'TEAM']] },
      { label: 'Departments', href: '/departments', icon: Building2, anyOf: [['department.view']] },
      { label: 'Positions', href: '/positions', icon: BriefcaseBusiness, anyOf: [['position.view']] },
    ],
  },
  {
    label: 'Time off & attendance',
    items: [
      {
        label: 'Attendance',
        href: '/attendance',
        icon: CalendarCheck,
        anyOf: [['attendance.view'], ['attendance.self']],
      },
      { label: 'Leave', href: '/leave', icon: Plane, anyOf: [['leave.create']] },
      { label: 'Leave requests', href: '/leave/requests', icon: ListChecks, anyOf: [['leave.approve']] },
      { label: 'Documents', href: '/documents', icon: FileText, anyOf: [['document.view']] },
    ],
  },
  {
    label: 'Insights',
    items: [{ label: 'Reports', href: '/reports', icon: ChartColumn, anyOf: [['report.view']] }],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Users', href: '/users', icon: UserCog, anyOf: [['user.view']] },
      { label: 'Roles & permissions', href: '/roles', icon: ShieldCheck, anyOf: [['role.manage']] },
      { label: 'Leave types', href: '/leave/types', icon: Tags, anyOf: [['leave.manage_types']] },
      { label: 'Document types', href: '/documents/types', icon: FolderCog, anyOf: [['document.manage_types']] },
      { label: 'Audit log', href: '/audit-logs', icon: ScrollText, anyOf: [['audit.view', 'ALL']] },
      { label: 'Settings', href: '/settings', icon: Settings, anyOf: [['settings.manage']] },
    ],
  },
];

export function meetsAny(permissions: PermissionMap, anyOf: readonly Requirement[] | undefined): boolean {
  if (!anyOf || anyOf.length === 0) return true;
  return anyOf.some(([key, scope]) => can(permissions, key, scope));
}

/** The groups and items this user may see. Groups left empty are dropped. */
export function visibleNavigation(permissions: PermissionMap): NavGroup[] {
  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => meetsAny(permissions, item.anyOf)),
  })).filter((group) => group.items.length > 0);
}

/**
 * The item a path belongs to. The longest matching href wins, so /leave/requests highlights
 * "Leave requests" rather than "Leave".
 */
export function activeItem(groups: readonly NavGroup[], pathname: string): NavItem | undefined {
  let best: NavItem | undefined;
  for (const item of groups.flatMap((group) => group.items)) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}
