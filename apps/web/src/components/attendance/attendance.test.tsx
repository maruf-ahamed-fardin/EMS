import type { AttendanceItem, MyAttendanceToday } from '@ems/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiRequestError } from '@/lib/api-error';
import { attendanceHref, formatDuration, formatTime, toClockInput } from '@/lib/attendance';
import { CheckInCard } from './check-in-card';
import { CorrectionDialog } from './correction-dialog';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));

const api = vi.fn();
vi.mock('@/lib/api-client', () => ({ api: (...args: unknown[]) => api(...args) }));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock('sonner', () => ({ toast: { success: (m: string) => toast.success(m), error: (m: string) => toast.error(m) } }));

describe('attendance helpers', () => {
  it('shows times in Dhaka and durations in hours and minutes', () => {
    expect(formatTime('2026-09-17T03:15:00.000Z')).toBe('09:15');
    expect(formatTime(null)).toBe('—');
    expect(toClockInput('2026-09-17T12:00:00.000Z')).toBe('18:00');
    expect(formatDuration(535)).toBe('8h 55m');
    expect(formatDuration(480)).toBe('8h');
    expect(formatDuration(40)).toBe('40m');
    expect(formatDuration(0)).toBe('—');
  });

  it('builds list URLs that reset the page when a filter changes', () => {
    expect(attendanceHref({ from: '2026-09-01', page: '3' }, { status: 'LATE' })).toBe('/attendance?from=2026-09-01&status=LATE');
  });
});

const beforeCheckIn: MyAttendanceToday = {
  today: '2026-09-17',
  isWorkingDay: true,
  lateAfter: '09:15',
  onLeave: false,
  attendance: null,
  canCheckIn: true,
  canCheckOut: false,
  reason: null,
};

describe('CheckInCard', () => {
  beforeEach(() => {
    api.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
  });

  it('checks in and switches to check out, saying if it was late', async () => {
    api.mockResolvedValueOnce({
      data: {
        ...beforeCheckIn,
        canCheckIn: false,
        canCheckOut: true,
        attendance: { id: 'a1', firstInAt: '2026-09-17T03:20:00.000Z', lastOutAt: null, workedMinutes: 0, lateMinutes: 20, status: 'LATE' },
      },
    });
    render(<CheckInCard initial={beforeCheckIn} />);
    expect(screen.getByText('Check-ins after 09:15 count as late.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Check in/ }));
    expect(await screen.findByRole('button', { name: /Check out/ })).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/attendance/check-in', { method: 'POST' });
    expect(toast.success).toHaveBeenCalledWith('Checked in at 09:20 (late)');
    expect(screen.getByText('Late by')).toBeInTheDocument();
  });

  it("shows the API's reason when checking in fails", async () => {
    api.mockRejectedValueOnce(new ApiRequestError(409, { message: 'You have already checked in today' }));
    render(<CheckInCard initial={beforeCheckIn} />);
    fireEvent.click(screen.getByRole('button', { name: /Check in/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('You have already checked in today'));
  });

  it('offers nothing on a day of leave and says why', () => {
    render(<CheckInCard initial={{ ...beforeCheckIn, onLeave: true, canCheckIn: false, reason: "You're on approved leave today" }} />);
    expect(screen.queryByRole('button', { name: /Check in/ })).not.toBeInTheDocument();
    expect(screen.getByText("You're on approved leave today")).toBeInTheDocument();
  });
});

const record: AttendanceItem = {
  id: 'r1',
  employee: { id: 'e1', name: 'Tanvir Hasan', employeeCode: 'SX-003', departmentName: 'Development' },
  workDate: '2026-09-17',
  firstInAt: '2026-09-17T03:16:00.000Z',
  lastOutAt: null,
  workedMinutes: 0,
  lateMinutes: 16,
  status: 'LATE',
  note: null,
  corrected: false,
};

describe('CorrectionDialog', () => {
  beforeEach(() => api.mockReset());

  it('prefills Dhaka times, needs a reason, and sends HH:mm times with empty ones as null', async () => {
    api.mockResolvedValue({ data: record });
    render(<CorrectionDialog record={record} />);
    fireEvent.click(screen.getByRole('button', { name: /Correct Tanvir Hasan/ }));

    expect(await screen.findByLabelText('Checked in')).toHaveValue('09:16');
    fireEvent.click(screen.getByRole('button', { name: 'Save correction' }));
    expect(await screen.findByText('Say why this is being corrected')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();

    fireEvent.input(screen.getByLabelText(/Reason/), { target: { value: 'Badge reader was down' } });
    fireEvent.input(screen.getByLabelText('Checked in'), { target: { value: '09:05' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save correction' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/attendance/r1', {
        method: 'PATCH',
        body: expect.objectContaining({ firstIn: '09:05', lastOut: null, note: 'Badge reader was down' }),
      }),
    );
  });

  it('refuses a check-out before the check-in', async () => {
    render(<CorrectionDialog record={record} />);
    fireEvent.click(screen.getByRole('button', { name: /Correct Tanvir Hasan/ }));
    fireEvent.input(await screen.findByLabelText('Checked out'), { target: { value: '08:00' } });
    fireEvent.input(screen.getByLabelText(/Reason/), { target: { value: 'Typo fix' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save correction' }));
    expect(await screen.findByText('Check-out must be after check-in')).toBeInTheDocument();
  });
});
