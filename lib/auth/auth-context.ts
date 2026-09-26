import type { PermissionMap } from '@/lib/validations';

/** What the session guard attaches to `req.auth` for a signed-in request. */
export interface AuthContext {
  sessionId: string;
  user: {
    id: string;
    email: string;
    name: string;
    employeeId: string | null;
    role: { id: string; key: string; name: string };
  };
  permissions: PermissionMap;
}

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
    auth?: AuthContext;
  }
}
