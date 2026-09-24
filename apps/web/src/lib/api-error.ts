import type { ApiError } from '@ems/contracts';

/** A failed API call, carrying the API's own message, field errors and request id. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly errors: Record<string, string>;
  readonly requestId: string | undefined;

  constructor(status: number, body: Partial<ApiError> | undefined) {
    super(body?.message ?? (status >= 500 ? 'Something went wrong' : `Request failed (${status})`));
    this.name = 'ApiRequestError';
    this.status = status;
    this.errors = body?.errors ?? {};
    this.requestId = body?.requestId;
  }
}

export async function readApiError(response: Response): Promise<ApiRequestError> {
  let body: Partial<ApiError> | undefined;
  try {
    body = (await response.json()) as Partial<ApiError>;
  } catch {
    body = undefined;
  }
  return new ApiRequestError(response.status, body);
}

/**
 * The API could not be reached at all: no response, so there is no status and no request id.
 * Separate from {@link ApiRequestError}, which carries the API's own answer.
 */
export class ApiUnreachableError extends Error {
  readonly origin: string;

  constructor(origin: string, cause?: unknown) {
    super(
      `Cannot reach the API at ${origin}. Is it running? ` +
        'In development, `yarn dev` starts it on :4000; in a container, check API_ORIGIN.',
      { cause },
    );
    this.name = 'ApiUnreachableError';
    this.origin = origin;
  }
}
