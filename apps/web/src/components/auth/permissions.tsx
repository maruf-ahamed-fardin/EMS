'use client';

import { can, type PermissionKey, type PermissionMap, type PermissionScope } from '@ems/contracts';
import { createContext, useContext } from 'react';

const PermissionsContext = createContext<PermissionMap>({});

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: PermissionMap;
  children: React.ReactNode;
}) {
  return <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): PermissionMap {
  return useContext(PermissionsContext);
}

/** Hides UI the user can't use. Presentation only: the API enforces every permission itself. */
export function useCan(permission: PermissionKey, atLeast?: PermissionScope): boolean {
  return can(usePermissions(), permission, atLeast);
}

export function Can({
  permission,
  atLeast,
  fallback = null,
  children,
}: {
  permission: PermissionKey;
  atLeast?: PermissionScope;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  return useCan(permission, atLeast) ? children : fallback;
}
