import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeleteButton } from '@/components/shared/delete-button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiRequestError } from '@/lib/client/api-error';
import { DepartmentFormDialog } from './department-form-dialog';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh, replace: vi.fn() }) }));

const api = vi.fn();
vi.mock('@/lib/client/api-client', () => ({ api: (...args: unknown[]) => api(...args) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('DepartmentFormDialog', () => {
  beforeEach(() => {
    api.mockReset();
    push.mockReset();
    // Head options load when the dialog opens
    api.mockImplementation((path: string) =>
      path === '/departments/head-options' ? Promise.resolve({ data: [] }) : Promise.reject(new Error(`unexpected ${path}`)),
    );
  });

  it('validates the code before saving', async () => {
    render(<DepartmentFormDialog />);
    fireEvent.click(screen.getByRole('button', { name: /Add department/ }));
    fireEvent.input(await screen.findByLabelText(/Name/), { target: { value: 'Support' } });
    fireEvent.input(screen.getByLabelText(/Code/), { target: { value: 'S' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create department' }));

    expect(await screen.findByText(/Use 2–10 letters or digits/)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalledWith('/departments', expect.anything());
  });

  it('shows duplicate errors from the API on the fields', async () => {
    api.mockImplementation((path: string) => {
      if (path === '/departments/head-options') return Promise.resolve({ data: [] });
      return Promise.reject(
        new ApiRequestError(409, { message: 'Some details are already used', errors: { code: 'Another department already uses this code' } }),
      );
    });
    render(<DepartmentFormDialog />);
    fireEvent.click(screen.getByRole('button', { name: /Add department/ }));
    fireEvent.input(await screen.findByLabelText(/Name/), { target: { value: 'Support' } });
    fireEvent.input(screen.getByLabelText(/Code/), { target: { value: 'dev' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create department' }));

    expect(await screen.findByText('Another department already uses this code')).toBeInTheDocument();
    await waitFor(() => expect(api).toHaveBeenCalledWith('/departments', { method: 'POST', body: expect.objectContaining({ code: 'DEV' }) }));
    expect(push).not.toHaveBeenCalled();
  });

  it('opens the new department after creating it', async () => {
    api.mockImplementation((path: string) =>
      path === '/departments/head-options' ? Promise.resolve({ data: [] }) : Promise.resolve({ data: { id: 'd-new', name: 'Support' } }),
    );
    render(<DepartmentFormDialog />);
    fireEvent.click(screen.getByRole('button', { name: /Add department/ }));
    fireEvent.input(await screen.findByLabelText(/Name/), { target: { value: 'Support' } });
    fireEvent.input(screen.getByLabelText(/Code/), { target: { value: 'sup' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create department' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/departments/d-new'));
  });
});

describe('DeleteButton', () => {
  it('stays disabled and explains why when deleting is blocked', () => {
    render(
      <TooltipProvider>
        <DeleteButton
          path="/departments/d1"
          title="Delete?"
          description="Gone"
          successMessage="Deleted"
          blockedReason="22 active employees work here. Move them first."
        />
      </TooltipProvider>,
    );
    expect(screen.getByRole('button', { name: /Delete/ })).toBeDisabled();
    expect(screen.getByLabelText('Delete: 22 active employees work here. Move them first.')).toBeInTheDocument();
  });

  it('asks before deleting and calls the API once confirmed', async () => {
    api.mockReset();
    api.mockResolvedValue(undefined);
    render(
      <TooltipProvider>
        <DeleteButton path="/positions/p1" title="Delete Intern?" description="Gone" successMessage="Deleted" />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Delete Intern?')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1)!);
    await waitFor(() => expect(api).toHaveBeenCalledWith('/positions/p1', { method: 'DELETE' }));
  });
});
