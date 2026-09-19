'use client';

import type { UserFormOptions, UserListItem } from '@ems/contracts';
import { KeyRound, LoaderCircle, Power, PowerOff, UserCog, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { FormAlert } from '@/components/forms/form-alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { ApiRequestError } from '@/lib/api-error';

const message = (error: unknown) => (error instanceof ApiRequestError ? (Object.values(error.errors)[0] ?? error.message) : 'Something went wrong. Try again.');

/** Creates an account for an employee without one; they get an email to choose their password. */
export function CreateUserDialog({ options }: { options: UserFormOptions }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [roleId, setRoleId] = useState(options.roles.find((r) => r.key === 'employee')?.id ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const person = options.employeesWithoutAccount.find((e) => e.id === employeeId);

  async function create() {
    if (!employeeId || !roleId) {
      setError('Choose an employee and a role');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api('/users', { method: 'POST', body: { employeeId, roleId } });
      toast.success(`Account created. ${person?.name ?? 'They'} will get an email to choose a password.`);
      setOpen(false);
      setEmployeeId('');
      router.refresh();
    } catch (err) {
      setError(message(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && (setOpen(next), setError(null))}>
      <DialogTrigger asChild>
        <Button className="h-10" disabled={options.employeesWithoutAccount.length === 0}>
          <UserPlus aria-hidden /> Create account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create account</DialogTitle>
          <DialogDescription>For an employee who can&rsquo;t sign in yet. They choose their own password from an emailed link that works for 3 days.</DialogDescription>
        </DialogHeader>
        {error && <FormAlert tone="error">{error}</FormAlert>}
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label id="create-user-employee">Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="h-10 w-full" aria-labelledby="create-user-employee">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {options.employeesWithoutAccount.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {e.employeeCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {person && <p className="text-xs text-muted-foreground">Signs in with {person.email}</p>}
          </div>
          <RoleSelect id="create-user-role" roles={options.roles} value={roleId} onChange={setRoleId} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => void create()} disabled={pending}>
            {pending && <LoaderCircle className="animate-spin" aria-hidden />} Create account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleSelect({ id, roles, value, onChange }: { id: string; roles: UserFormOptions['roles']; value: string; onChange: (id: string) => void }) {
  const chosen = roles.find((r) => r.id === value);
  return (
    <div className="grid gap-2">
      <Label id={id}>Role</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 w-full" aria-labelledby={id}>
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {roles.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {chosen?.description && <p className="text-xs text-muted-foreground">{chosen.description}</p>}
    </div>
  );
}

type Confirm = 'deactivate' | 'activate' | 'reset' | null;

/** The actions on one account, as the API allows them for this viewer. */
export function UserActions({ user, roles }: { user: UserListItem; roles: UserFormOptions['roles'] }) {
  const router = useRouter();
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleId, setRoleId] = useState(user.role.id);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [pending, setPending] = useState(false);
  const allowed = user.allowedActions;
  if (!allowed.changeRole && !allowed.deactivate && !allowed.activate && !allowed.sendReset) return null;

  async function run(path: string, body: object, method: 'POST' | 'PATCH', success: string) {
    setPending(true);
    try {
      await api(`/users/${user.id}${path}`, { method, body });
      toast.success(success);
      setRoleOpen(false);
      setConfirm(null);
      router.refresh();
    } catch (err) {
      toast.error(message(err));
    } finally {
      setPending(false);
    }
  }

  const copy = {
    deactivate: { title: `Deactivate ${user.name}'s account?`, text: 'They are signed out everywhere and can’t sign in until the account is activated again. Their employee record stays as it is.', button: 'Deactivate' },
    activate: { title: `Activate ${user.name}'s account?`, text: user.lockedUntil ? 'This also lifts the lockout from too many wrong passwords.' : 'They can sign in again with their password.', button: 'Activate' },
    reset: { title: `Send ${user.name} a password link?`, text: `An email goes to ${user.email} with a link to choose a new password, valid for 3 days. Their current password keeps working until they use it.`, button: 'Send link' },
  } as const;

  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-1">
      {allowed.changeRole && (
        <Dialog open={roleOpen} onOpenChange={(next) => !pending && (setRoleOpen(next), setRoleId(user.role.id))}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9" aria-label={`Change ${user.name}'s role`}>
              <UserCog aria-hidden />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Change {user.name}&rsquo;s role</DialogTitle>
              <DialogDescription>The new permissions apply on their next click; they don&rsquo;t need to sign in again.</DialogDescription>
            </DialogHeader>
            <RoleSelect id={`role-${user.id}`} roles={roles} value={roleId} onChange={setRoleId} />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRoleOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={() => void run('/role', { roleId }, 'PATCH', `${user.name} is now ${roles.find((r) => r.id === roleId)?.name ?? 'updated'}`)} disabled={pending || roleId === user.role.id}>
                {pending && <LoaderCircle className="animate-spin" aria-hidden />} Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {allowed.sendReset && (
        <Button variant="ghost" size="icon" className="size-9" onClick={() => setConfirm('reset')} aria-label={`Send ${user.name} a password link`}>
          <KeyRound aria-hidden />
        </Button>
      )}
      {allowed.activate && (
        <Button variant="ghost" size="icon" className="size-9" onClick={() => setConfirm('activate')} aria-label={`Activate ${user.name}'s account`}>
          <Power aria-hidden />
        </Button>
      )}
      {allowed.deactivate && (
        <Button variant="ghost" size="icon" className="size-9 text-danger-text hover:text-danger-text" onClick={() => setConfirm('deactivate')} aria-label={`Deactivate ${user.name}'s account`}>
          <PowerOff aria-hidden />
        </Button>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(next) => !pending && !next && setConfirm(null)}>
        {confirm && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{copy[confirm].title}</AlertDialogTitle>
              <AlertDialogDescription>{copy[confirm].text}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Back</AlertDialogCancel>
              <Button
                variant={confirm === 'deactivate' ? 'destructive' : 'default'}
                disabled={pending}
                onClick={() =>
                  void run(
                    confirm === 'reset' ? '/send-reset' : `/${confirm}`,
                    {},
                    'POST',
                    confirm === 'reset' ? `Password link sent to ${user.email}` : confirm === 'activate' ? `${user.name} can sign in again` : `${user.name} is signed out and can’t sign in`,
                  )
                }
              >
                {pending && <LoaderCircle className="animate-spin" aria-hidden />}
                {copy[confirm].button}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
