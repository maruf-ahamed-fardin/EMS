import 'server-only';
import type { EmbeddedApi } from '@ems/backend';

type Start = () => Promise<EmbeddedApi>;

interface Running {
  /** The start function it came from: a new one means `next dev` reloaded the API's code */
  start: Start;
  api: Promise<EmbeddedApi>;
}

/** Where the running API is kept between calls. */
export interface EmbeddedApiState {
  emsEmbeddedApi?: Running;
}

/**
 * The logic behind {@link embeddedApi}, with the package loader and the state passed in so that it can
 * be tested without the API package.
 */
export function embeddedApiLoader(load: () => Promise<{ startEmbeddedApi: Start }>, state: EmbeddedApiState) {
  return async function get(): Promise<EmbeddedApi> {
    const { startEmbeddedApi } = await load();
    const current = state.emsEmbeddedApi;
    if (current?.start === startEmbeddedApi) return current.api;

    const running: Running = {
      start: startEmbeddedApi,
      api: startEmbeddedApi().catch((error: unknown) => {
        if (state.emsEmbeddedApi === running) state.emsEmbeddedApi = undefined;
        throw error;
      }),
    };
    state.emsEmbeddedApi = running;
    current?.api.then((api) => api.close()).catch(() => {});
    return running.api;
  };
}

/**
 * The API (apps/web/server) running inside this Node process, started on first use. It listens on the
 * loopback interface only; browsers reach it through app/api/[...path]/route.ts and server components
 * through lib/server-api.ts. A start that fails (for example a missing environment variable) is
 * retried on the next request rather than remembered. In development, when `yarn dev` rebuilds the
 * API, the next request starts the new code and closes the old.
 *
 * One API per server process, kept on globalThis so that `next dev`, which reloads this module, finds it.
 */
export const embeddedApi = embeddedApiLoader(() => import('@ems/backend'), globalThis as EmbeddedApiState);
