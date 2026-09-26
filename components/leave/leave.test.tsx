import type { LeaveBalanceRow, LeaveRequestItem } from '@/lib/validations';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiRequestError } from '@/lib/client/api-error';
import { daysLabel, formatLeaveRange } from '@/lib/client/leave';
import { BalanceAdjustDialog } from './balance-adjust-dialog';
import { LeaveBalanceCards } from './leave-balance-cards';
import { LeaveRequestActions } from './leave-request-actions';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));

const api = vi.fn();
vi.mock('@/lib/client/api-client', () => ({ api: (...args: unknown[]) => api(...args) }));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock('sonner', () => ({ toast: { success: (m: string) => toast.success(m), error: (m: string) => toast.error(m) } }));

beforeEach(() => {
  api.mockReset();
  refresh.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

describe('leave helpers', () => {
  it('writes ranges and day counts in words', () => {
    expect(formatLeaveRange('2026-09-24', '2026-09-24')).toBe('24 Sep 2026');
    expect(formatLeaveRange('2026-09-24', '2026-09-28')).toBe('24 Sep – 28 Sep 2026');
    expect(daysLabel(1)).toBe('1 day');
    expect(daysLabel(2.5)).toBe('2.5 days');
  });
});

const balance: LeaveBalanceRow = {
  id: 'b1',
  employee: { id: 'e1', name: 'Rahim Ahmed', employeeCode: 'SX-014' },
  leaveType: { id: 't1', name: 'Annual', code: 'ANNUAL', isPaid: true },
  year: 2026,
  allocated: 18,
  carriedForward: 2,
  used: 5,
  pending: 3,
  available: 12,
};

describe('LeaveBalanceCards', () => {
  it('shows what is left against allowance plus carried-over days', () => {
    render(<LeaveBalanceCards balances={[balance]} />);
    expect(screen.getByText('of 20 left')).toBeInTheDocument();
    expect(screen.getByText('5 days used · 3 days waiting · 2 days carried over')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '5 used, 3 pending, 12 available' })).toBeInTheDocument();
  });

  it('says so when there are no balances', () => {
    render(<LeaveBalanceCards balances={[]} />);
    expect(screen.getByText('No leave balances for this year yet.')).toBeInTheDocument();
  });
});

const request: LeaveRequestItem = {
  id: 'r1',
  employee: { id: 'e1', name: 'Rahim Ahmed', employeeCode: 'SX-014', departmentName: 'Engineering' },
  leaveType: { id: 't1', name: 'Annual', isPaid: true },
  startDate: '2026-09-24',
  endDate: '2026-09-28',
  days: 3,
  reason: 'Family visit',
  status: 'PENDING',
  requestedAt: '2026-09-17T04:00:00.000Z',
  reviewedBy: null,
  reviewedAt: null,
  reviewNote: null,
  allowedActions: { approve: true, reject: true, cancel: false },
  balanceAvailable: 12,
};

describe('LeaveRequestActions', () => {
  it('shows nothing when the viewer may not act', () => {
    const { container } = render(<LeaveRequestActions request={{ ...request, allowedActions: { approve: false, reject: false, cancel: false } }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('approves and names the person', async () => {
    api.mockResolvedValueOnce({ data: { ...request, status: 'APPROVED' } });
    render(<LeaveRequestActions request={request} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/leave/requests/r1/approve', { method: 'PATCH', body: { note: undefined } }));
    expect(toast.success).toHaveBeenCalledWith('Leave approved for Rahim Ahmed');
    expect(refresh).toHaveBeenCalled();
  });

  it('needs a reason before rejecting', async () => {
    api.mockResolvedValueOnce({ data: { ...request, status: 'REJECTED' } });
    render(<LeaveRequestActions request={request} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    const confirm = await screen.findByRole('button', { name: 'Reject' });
    fireEvent.click(confirm);
    expect(await screen.findByText('Tell them why it was rejected')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Reason (shown to them)'), { target: { value: 'Release week' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api).toHaveBeenCalledWith('/leave/requests/r1/reject', { method: 'PATCH', body: { note: 'Release week' } }));
  });

  it('shows the API message when a decision fails', async () => {
    api.mockRejectedValueOnce(new ApiRequestError(409, { message: 'This request has already been decided' }));
    render(<LeaveRequestActions request={request} />);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('This request has already been decided'));
  });
});

describe('BalanceAdjustDialog', () => {
  it('needs a reason, then saves the new allowance', async () => {
    api.mockResolvedValueOnce({ data: { ...balance, allocated: 20 } });
    render(<BalanceAdjustDialog balance={balance} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adjust Annual balance' }));

    fireEvent.change(await screen.findByLabelText(/Allowance/), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save balance' }));
    expect(await screen.findByText('Say why the balance is changing')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Agreed at hiring' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save balance' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/leave/balances/b1', { method: 'PATCH', body: { allocated: 20, carriedForward: 2, note: 'Agreed at hiring' } }),
    );
    expect(toast.success).toHaveBeenCalledWith('Annual balance updated for Rahim Ahmed');
  });

  it('puts a server field error back on the field', async () => {
    api.mockRejectedValueOnce(
      new ApiRequestError(400, { message: 'Check the highlighted fields', errors: { allocated: "At least 8 days are already used or pending, so the balance can't go below that" } }),
    );
    render(<BalanceAdjustDialog balance={balance} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adjust Annual balance' }));
    fireEvent.change(await screen.findByLabelText(/Allowance/), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Correction' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save balance' }));
    expect(await screen.findByText("At least 8 days are already used or pending, so the balance can't go below that")).toBeInTheDocument();
  });
});
