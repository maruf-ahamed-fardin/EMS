import type { EmployeeFormOptions } from '@ems/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { CreateEmployeeWizard, stepForField } from './create-employee-wizard';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }) }));

const api = vi.fn();
vi.mock('@/lib/api-client', () => ({ api: (...args: unknown[]) => api(...args) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const options: EmployeeFormOptions = {
  departments: [{ id: '0192f0c3-0000-7000-8000-00000000000d', name: 'Development', code: 'DEV' }],
  positions: [{ id: '0192f0c3-0000-7000-8000-00000000000e', title: 'QA Engineer', departmentId: '0192f0c3-0000-7000-8000-00000000000d' }],
  managers: [],
  roles: [{ key: 'employee', name: 'Employee' }],
  nextEmployeeCode: 'SX-061',
};

describe('stepForField', () => {
  it('maps a server error to the step that owns the field', () => {
    expect(stepForField('lastName')).toBe(0);
    expect(stepForField('positionId')).toBe(1);
    expect(stepForField('address.city')).toBe(2);
    expect(stepForField('roleKey')).toBe(3);
    expect(stepForField('somethingElse')).toBe(4);
  });
});

describe('CreateEmployeeWizard', () => {
  beforeEach(() => {
    api.mockReset();
    push.mockReset();
    window.scrollTo = vi.fn();
  });

  it('stays on a step until its fields are valid', async () => {
    render(<CreateEmployeeWizard options={options} />);
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    expect(await screen.findByText('Enter a first name')).toBeInTheDocument();
    expect(screen.getByText('Enter a last name')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Personal' })).toBeInTheDocument();
  });

  it('moves to the next step once the step is valid, and back again', async () => {
    render(<CreateEmployeeWizard options={options} />);
    fireEvent.input(screen.getByLabelText(/First name/), { target: { value: 'Tahmina' } });
    fireEvent.input(screen.getByLabelText(/Last name/), { target: { value: 'Sultana' } });
    fireEvent.input(screen.getByLabelText(/Date of birth/), { target: { value: '1997-05-02' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    expect(await screen.findByRole('heading', { name: 'Employment' })).toBeInTheDocument();
    expect(screen.getByText('Leave empty to use SX-061')).toBeInTheDocument();
    // The live preview already shows the name
    expect(screen.getAllByText('Tahmina Sultana').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(await screen.findByRole('heading', { name: 'Personal' })).toBeInTheDocument();
    expect(screen.getByLabelText(/First name/)).toHaveValue('Tahmina');
  });

  it('does not call the API before the review step', async () => {
    render(<CreateEmployeeWizard options={options} />);
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    await screen.findByText('Enter a first name');
    expect(api).not.toHaveBeenCalledWith('/employees', expect.anything());
  });
});
