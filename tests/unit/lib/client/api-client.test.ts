import { api } from '@/lib/client/api-client';
import { ApiRequestError } from '@/lib/client/api-error';

function jsonResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('api', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    document.cookie = 'ems_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  afterEach(() => vi.unstubAllGlobals());

  it('reads without a CSRF token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { ok: true } }));
    await expect(api('/auth/me')).resolves.toEqual({ data: { ok: true } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/v1/auth/me');
    expect((init?.headers as Record<string, string>)['x-csrf-token']).toBeUndefined();
  });

  it('fetches the CSRF cookie before the first write, then sends it', async () => {
    fetchMock
      .mockImplementationOnce(async () => {
        document.cookie = 'ems_csrf=token-from-server-123; path=/';
        return jsonResponse(200, { data: { csrfToken: 'token-from-server-123' } });
      })
      .mockResolvedValueOnce(jsonResponse(204));

    await api('/auth/logout', { method: 'POST' });
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/v1/auth/csrf');
    const [, init] = fetchMock.mock.calls[1]!;
    expect((init?.headers as Record<string, string>)['x-csrf-token']).toBe('token-from-server-123');
  });

  it('throws the API error with its field errors and request id', async () => {
    document.cookie = 'ems_csrf=present-token-1234567; path=/';
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, { statusCode: 422, message: 'Validation failed', errors: { email: 'Enter a valid email address' }, requestId: 'req-1' }),
    );
    const error = await api('/auth/login', { method: 'POST', body: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 422, errors: { email: 'Enter a valid email address' }, requestId: 'req-1' });
  });

  it('copes with a non-JSON failure (proxy error page)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(api('/auth/me')).rejects.toMatchObject({ status: 502, message: 'Something went wrong' });
  });
});
