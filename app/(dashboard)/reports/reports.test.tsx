import { fireEvent, render, screen } from '@testing-library/react';
import { defaultRange, exportHref, reportKey, reportParams, reportsHref } from '@/lib/client/reports';
import { ReportFilters } from './report-filters';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }) }));

describe('report helpers', () => {
  it('falls back to the employees report for anything unknown', () => {
    expect(reportKey('leave')).toBe('leave');
    expect(reportKey('salaries')).toBe('employees');
    expect(reportKey(undefined)).toBe('employees');
  });

  it('picks sensible default dates per report', () => {
    expect(defaultRange('attendance', '2026-09-19')).toEqual({ from: '2026-09-01', to: '2026-09-19' });
    expect(defaultRange('leave', '2026-09-19')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(defaultRange('departments', '2026-09-19')).toEqual({ from: '2026-01-01', to: '2026-09-19' });
    expect(defaultRange('employees', '2026-09-19')).toEqual({});
  });

  it("keeps only the filters a report understands, and builds page and download links", () => {
    const filters = reportParams('attendance', { from: '2026-09-01', to: '2026-09-19', status: 'LATE', leaveTypeId: 'x', report: 'attendance', page: '3', departmentId: '' });
    expect(filters).toEqual({ from: '2026-09-01', to: '2026-09-19', status: 'LATE' });
    expect(reportsHref('attendance', filters, 2)).toBe('/reports?report=attendance&from=2026-09-01&to=2026-09-19&status=LATE&page=2');
    expect(exportHref('attendance', filters, 'xlsx')).toBe('/api/v1/reports/attendance?from=2026-09-01&to=2026-09-19&status=LATE&format=xlsx');
  });
});

describe('ReportFilters', () => {
  beforeEach(() => replace.mockReset());

  it('shows only the fields of the chosen report and puts changes in the URL', () => {
    render(<ReportFilters report="attendance" values={{ from: '2026-09-01', to: '2026-09-19' }} departments={[{ value: 'd1', label: 'Engineering' }]} leaveTypes={[]} />);
    expect(screen.getByLabelText('From')).toHaveValue('2026-09-01');
    expect(screen.queryByText('Leave type')).not.toBeInTheDocument();
    expect(screen.queryByText('Employment type')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-09-10' } });
    expect(replace).toHaveBeenCalledWith('/reports?report=attendance&from=2026-09-01&to=2026-09-10', { scroll: false });
  });

  it('offers joined dates and employment type for the employees report', () => {
    render(<ReportFilters report="employees" values={{}} departments={[]} leaveTypes={[]} />);
    expect(screen.getByLabelText('Joined from')).toBeInTheDocument();
    expect(screen.getByText('Employment type')).toBeInTheDocument();
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
  });
});
