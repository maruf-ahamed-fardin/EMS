import { describe, expect, it, vi } from 'vitest';
import { embeddedApiLoader, type EmbeddedApiState } from './embedded-api';

const api = (port: number) => ({ origin: `http://127.0.0.1:${port}`, close: vi.fn().mockResolvedValue(undefined) });

function setup(start: () => Promise<ReturnType<typeof api>>) {
  const pkg = { startEmbeddedApi: vi.fn(start) };
  return { pkg, get: embeddedApiLoader(async () => pkg, {} as EmbeddedApiState) };
}

describe('embeddedApi', () => {
  it('starts the API once, however many requests arrive together', async () => {
    const { pkg, get } = setup(async () => api(4101));
    const [a, b] = await Promise.all([get(), get()]);
    expect(a.origin).toBe('http://127.0.0.1:4101');
    expect(b).toBe(a);
    expect(await get()).toBe(a);
    expect(pkg.startEmbeddedApi).toHaveBeenCalledTimes(1);
  });

  it('retries on the next request after a failed start', async () => {
    const { pkg, get } = setup(async () => api(4102));
    pkg.startEmbeddedApi.mockRejectedValueOnce(new Error('APP_URL: must be https in production'));
    await expect(get()).rejects.toThrow('APP_URL');
    expect((await get()).origin).toBe('http://127.0.0.1:4102');
  });

  it('starts reloaded code and closes the previous API', async () => {
    const first = api(4103);
    const { pkg, get } = setup(async () => first);
    await get();

    // What `next dev` does when the API is rebuilt: the module, and so the function, is new
    pkg.startEmbeddedApi = vi.fn(async () => api(4104));
    expect((await get()).origin).toBe('http://127.0.0.1:4104');
    await vi.waitFor(() => expect(first.close).toHaveBeenCalled());
  });
});
