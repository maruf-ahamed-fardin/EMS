import type { PermissionItem, RoleItem, UserListItem } from '@ems/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UserActions } from '../users/user-dialogs';
import { changedKeys, RoleEditor } from './role-editor';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));
const api = vi.fn();
vi.mock('@/lib/api-client', () => ({ api: (...args: unknown[]) => api(...args) }));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock('sonner', () => ({ toast: { success: (m: string) => toast.success(m), error: (m: string) => toast.error(m) } }));

beforeEach(() => {
  for (const m of [api, refresh, toast.success, toast.error]) m.mockReset();
});

const catalogue: PermissionItem[] = [
  { key: 'employee.view', module: 'employees', description: 'View employee profiles' },
  { key: 'report.view', module: 'reports', description: 'View reports' },
];

const role = (overrides: Partial<RoleItem>): RoleItem => ({
  id: 'r1',
  key: 'manager',
  name: 'Manager',
  description: null,
  isSystem: true,
  userCount: 3,
  permissions: { 'employee.view': 'TEAM' },
  editable: true,
  ...overrides,
});

describe('RoleEditor', () => {
  it('counts what differs between the saved and edited grants', () => {
    expect(changedKeys({ 'employee.view': 'TEAM' }, { 'employee.view': 'TEAM' })).toEqual([]);
    expect(changedKeys({ 'employee.view': 'TEAM' }, { 'employee.view': 'ALL', 'report.view': 'OWN' }).sort()).toEqual(['employee.view', 'report.view']);
    expect(changedKeys({ 'report.view': 'OWN' }, {})).toEqual(['report.view']);
  });

  it('groups permissions by module and saves nothing until something changes', () => {
    render(<RoleEditor role={role({})} catalogue={catalogue} canGrantAdmin />);
    expect(screen.getByRole('heading', { name: 'employees' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'View employee profiles for Manager' })).toHaveTextContent('Team');
    expect(screen.getByRole('combobox', { name: 'View reports for Manager' })).toHaveTextContent('No access');
    expect(screen.getByText('No changes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Manager/ })).toBeDisabled();
  });

  it('shows Super Admin read-only, without a save bar', () => {
    render(<RoleEditor role={role({ key: 'super_admin', name: 'Super Admin', editable: false })} catalogue={catalogue} canGrantAdmin />);
    expect(screen.getByText(/Super Admin always has every permission/)).toBeInTheDocument();
    for (const select of screen.getAllByRole('combobox')) expect(select).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument();
  });
});

const user: UserListItem = {
  id: 'u1',
  email: 'manager@demo.selorax.test',
  name: 'Tanvir Hasan',
  employee: { id: 'e1', name: 'Tanvir Hasan', employeeCode: 'SX-003', status: 'ACTIVE' },
  role: { id: 'r1', key: 'manager', name: 'Manager' },
  status: 'ACTIVE',
  lockedUntil: null,
  lastLoginAt: null,
  allowedActions: { changeRole: true, deactivate: true, activate: false, sendReset: true },
};
const roles = [
  { id: 'r1', key: 'manager', name: 'Manager', description: null },
  { id: 'r2', key: 'employee', name: 'Employee', description: null },
];

describe('UserActions', () => {
  it('shows only what the API allows', () => {
    const { container } = render(<UserActions user={{ ...user, allowedActions: { changeRole: false, deactivate: false, activate: false, sendReset: false } }} roles={roles} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('asks before deactivating, then deactivates', async () => {
    api.mockResolvedValueOnce({ data: { ...user, status: 'INACTIVE' } });
    render(<UserActions user={user} roles={roles} />);
    expect(screen.queryByRole('button', { name: "Activate Tanvir Hasan's account" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: "Deactivate Tanvir Hasan's account" }));
    expect(await screen.findByText(/signed out everywhere/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/users/u1/deactivate', { method: 'POST', body: {} }));
    expect(toast.success).toHaveBeenCalledWith('Tanvir Hasan is signed out and can’t sign in');
  });

  it('sends a password link after saying where it goes', async () => {
    api.mockResolvedValueOnce({ data: user });
    render(<UserActions user={user} roles={roles} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send Tanvir Hasan a password link' }));
    expect(await screen.findByText(/An email goes to manager@demo.selorax.test/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send link' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/users/u1/send-reset', { method: 'POST', body: {} }));
  });

  it('shows the API’s reason when a change is refused', async () => {
    const { ApiRequestError } = await import('@/lib/api-error');
    api.mockRejectedValueOnce(new ApiRequestError(409, { message: 'This is the only active Super Admin, so it stays active.' }));
    render(<UserActions user={user} roles={roles} />);
    fireEvent.click(screen.getByRole('button', { name: "Deactivate Tanvir Hasan's account" }));
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('This is the only active Super Admin, so it stays active.'));
  });
});
