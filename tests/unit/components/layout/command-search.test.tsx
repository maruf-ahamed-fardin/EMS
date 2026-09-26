import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PresenceBar } from '@/components/dashboard/presence-bar';
import { CommandSearch } from '@/components/layout/command-search';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const api = vi.fn();
vi.mock('@/lib/client/api-client', () => ({ api: (...args: unknown[]) => api(...args) }));

describe('CommandSearch', () => {
  beforeAll(() => {
    // cmdk scrolls the selected item into view; jsdom doesn't implement it
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    api.mockReset();
    push.mockReset();
  });

  it('opens with Ctrl+K and shows the API results without filtering them again', async () => {
    api.mockResolvedValue({
      data: {
        // "Tanvir" doesn't contain "has"; cmdk's own filter would hide it
        employees: [{ id: 'e3', name: 'Tanvir Hasan', employeeCode: 'SX-003', positionTitle: 'Engineering Manager', departmentName: 'Development' }],
        departments: [],
        positions: [],
      },
    });
    render(<CommandSearch />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    fireEvent.change(await screen.findByPlaceholderText(/Search people/), { target: { value: 'has' } });

    expect(await screen.findByText('Tanvir Hasan')).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/search?q=has');

    fireEvent.click(screen.getByText('Tanvir Hasan'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/employees/e3'));
  });

  it('waits for two characters before searching', async () => {
    render(<CommandSearch />);
    fireEvent.click(screen.getAllByRole('button', { name: /Search/ })[0]!);
    fireEvent.change(await screen.findByPlaceholderText(/Search people/), { target: { value: 'a' } });
    expect(screen.getByText('Type at least 2 characters.')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(api).not.toHaveBeenCalled();
  });
});

describe('PresenceBar', () => {
  it('labels every status with its count, not color alone', () => {
    render(<PresenceBar attendance={{ expected: 56, present: 49, onTime: 41, late: 8, onLeave: 4, notCheckedIn: 7, presentRate: 0.875 }} />);
    expect(screen.getByRole('img')).toHaveAccessibleName('On time: 41, Late: 8, On leave: 4, Not checked in: 7');
    expect(screen.getByText('Not checked in').nextElementSibling).toHaveTextContent('7');
  });
});
