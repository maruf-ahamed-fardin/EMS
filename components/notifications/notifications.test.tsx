import type { NotificationItem, PermissionMap } from '@/lib/validations';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PermissionsProvider } from '@/components/auth/permissions';
import { badgeLabel, NotificationBell } from './notification-bell';
import { NotificationList } from './notification-list';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh, replace: vi.fn() }) }));

const api = vi.fn();
vi.mock('@/lib/client/api-client', () => ({ api: (...args: unknown[]) => api(...args) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const unreadItem: NotificationItem = {
  id: 'n1',
  type: 'leave.requested',
  title: 'Rahim Ahmed asked for 3 days of Annual leave',
  body: '22–24 Sep: Family visit',
  link: '/leave/requests',
  readAt: null,
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
};
const readItem: NotificationItem = { ...unreadItem, id: 'n2', type: 'auth.password_changed', title: 'Your password was changed', link: null, readAt: '2026-09-17T04:00:00.000Z' };

function wrap(ui: React.ReactNode, permissions: PermissionMap = { 'notification.view': 'ALL' }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PermissionsProvider permissions={permissions}>{ui}</PermissionsProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  for (const mock of [api, push, refresh]) mock.mockReset();
});

describe('NotificationList', () => {
  it('marks an unread one read and goes where it points', async () => {
    api.mockResolvedValue({ data: { ...unreadItem, readAt: 'now' } });
    wrap(<NotificationList items={[unreadItem, readItem]} />);
    expect(screen.getByText('Unread:')).toHaveClass('sr-only');
    expect(screen.getAllByText('5m')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /Rahim Ahmed asked/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/leave/requests'));
    expect(api).toHaveBeenCalledWith('/notifications/n1/read', { method: 'PATCH' });
  });

  it("doesn't mark a read one again, and stays put without a link", async () => {
    wrap(<NotificationList items={[readItem]} />);
    fireEvent.click(screen.getByRole('button', { name: /Your password was changed/ }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(api).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('NotificationBell', () => {
  it('shows the unread count, and loads the latest only when opened', async () => {
    api.mockImplementation((path: string) =>
      Promise.resolve(path === '/notifications/unread-count' ? { data: { count: 3 } } : { data: [unreadItem], meta: { page: 1, limit: 6, total: 1, totalPages: 1 } }),
    );
    wrap(<NotificationBell />);
    const bell = await screen.findByRole('button', { name: 'Notifications, 3 unread' });
    expect(api).toHaveBeenCalledTimes(1);

    fireEvent.click(bell);
    expect(await screen.findByText('Rahim Ahmed asked for 3 days of Annual leave')).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/notifications?limit=6');
    expect(screen.getByRole('link', { name: 'See all notifications' })).toHaveAttribute('href', '/notifications');
  });

  it('marks all read and refreshes the count', async () => {
    let count = 2;
    api.mockImplementation((path: string) => {
      if (path === '/notifications/read-all') {
        count = 0;
        return Promise.resolve({ data: { updated: 2 } });
      }
      return Promise.resolve(path === '/notifications/unread-count' ? { data: { count } } : { data: [], meta: { page: 1, limit: 6, total: 0, totalPages: 1 } });
    });
    wrap(<NotificationBell />);
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
    fireEvent.click(await screen.findByRole('button', { name: /Mark all read/ }));
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/notifications/read-all', { method: 'PATCH' });
  });

  it('is hidden without notification.view, and never polls', () => {
    const { container } = wrap(<NotificationBell />, {});
    expect(container).toBeEmptyDOMElement();
    expect(api).not.toHaveBeenCalled();
  });

  it('caps the badge at 99+', () => {
    expect(badgeLabel(7)).toBe('7');
    expect(badgeLabel(150)).toBe('99+');
  });
});
