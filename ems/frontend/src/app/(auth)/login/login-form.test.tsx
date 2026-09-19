import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render as renderInDom, screen, waitFor } from '@testing-library/react';
import { ApiRequestError } from '@/lib/api-error';
import { LoginForm } from './login-form';

// The form clears the query cache on sign-in, so it needs a client like the app's providers give it
const render = (ui: React.ReactElement) => renderInDom(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

const replace = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh }) }));

const api = vi.fn();
vi.mock('@/lib/api-client', () => ({ api: (...args: unknown[]) => api(...args) }));

function fill(email: string, password: string) {
  fireEvent.input(screen.getByLabelText(/Work email/), { target: { value: email } });
  fireEvent.input(screen.getByLabelText(/^Password/), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginForm', () => {
  beforeEach(() => {
    api.mockReset();
    replace.mockReset();
  });

  it('validates before calling the API', async () => {
    render(<LoginForm next="/dashboard" passwordWasReset={false} />);
    fill('not-an-email', '');
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(screen.getByLabelText(/Work email/)).toHaveAttribute('aria-invalid', 'true');
    expect(api).not.toHaveBeenCalled();
  });

  it('signs in with a normalized email and goes to the requested page', async () => {
    api.mockResolvedValueOnce({ data: {} });
    render(<LoginForm next="/leave/requests" passwordWasReset={false} />);
    fill('  Rahim@Demo.SeloraX.test ', 'correct-horse-9');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/leave/requests'));
    expect(api).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { email: 'rahim@demo.selorax.test', password: 'correct-horse-9' },
    });
  });

  it("shows the API's message when sign-in fails", async () => {
    api.mockRejectedValueOnce(new ApiRequestError(401, { message: 'Email or password is incorrect' }));
    render(<LoginForm next="/dashboard" passwordWasReset={false} />);
    fill('rahim@demo.selorax.test', 'wrong-password-1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
    expect(replace).not.toHaveBeenCalled();
  });

  it('explains rate limiting in plain words', async () => {
    api.mockRejectedValueOnce(new ApiRequestError(429, { message: 'Too many requests. Try again shortly.' }));
    render(<LoginForm next="/dashboard" passwordWasReset={false} />);
    fill('rahim@demo.selorax.test', 'wrong-password-1');
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts. Wait a minute and try again.');
  });

  it('confirms a completed password reset', () => {
    render(<LoginForm next="/dashboard" passwordWasReset />);
    expect(screen.getByRole('status')).toHaveTextContent('Your password was changed');
  });
});
