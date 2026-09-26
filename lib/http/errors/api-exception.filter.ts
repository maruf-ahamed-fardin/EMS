import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ApiError } from '@/lib/validations';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { currentRequest } from '../request-context';
import { safeUrl } from '../logging/logger.options';
import { zodIssuesToFieldErrors } from './field-errors';

const GENERIC_MESSAGES: Partial<Record<number, string>> = {
  [HttpStatus.UNAUTHORIZED]: 'You need to sign in',
  [HttpStatus.FORBIDDEN]: "You don't have access to this",
  [HttpStatus.NOT_FOUND]: 'Not found',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests. Try again shortly.',
};

/** PostgreSQL's code for a violated CHECK constraint, which Prisma passes through from the driver. */
const CHECK_VIOLATION = '23514';

/** Prisma error codes that describe the request rather than a server fault. */
const PRISMA_CLIENT_ERRORS: Record<string, { status: number; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'A record with these details already exists' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Not found' },
};

/**
 * Turns every thrown error into the spec §35 shape. 500s never expose the underlying message or
 * stack; the requestId ties the response to the log line that has them.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();
    const requestId = currentRequest()?.requestId ?? req.id ?? 'unknown';

    const body = this.toApiError(exception, requestId);
    if (body.statusCode >= 500) {
      this.logger.error(
        { err: exception, requestId, method: req.method, url: safeUrl(req.originalUrl) },
        'Unhandled error',
      );
    }

    if (!res.headersSent) res.status(body.statusCode).json(body);
  }

  toApiError(exception: unknown, requestId: string): ApiError {
    if (exception instanceof ZodValidationException) {
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'Validation failed',
        errors: zodIssuesToFieldErrors(exception.getZodError()),
        requestId,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const errors = statusCode < 500 ? fieldErrorsOf(exception) : undefined;
      return { statusCode, message: httpExceptionMessage(exception, statusCode), ...(errors ? { errors } : {}), requestId };
    }

    const prisma = prismaClientError(exception);
    if (prisma) return { statusCode: prisma.status, message: prisma.message, requestId };

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Something went wrong', requestId };
  }
}

/** Services throw `{ message, error, errors: { field: message } }` for rules zod can't check. */
function fieldErrorsOf(exception: HttpException): Record<string, string> | undefined {
  const response = exception.getResponse();
  if (typeof response !== 'object' || response === null) return undefined;
  const { errors } = response as { errors?: unknown };
  if (typeof errors !== 'object' || errors === null) return undefined;
  const entries = Object.entries(errors).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function httpExceptionMessage(exception: HttpException, statusCode: number): string {
  if (statusCode >= 500) return 'Something went wrong';
  // The throttler's own text ("ThrottlerException: Too Many Requests") isn't for people
  if (statusCode === Number(HttpStatus.TOO_MANY_REQUESTS)) return GENERIC_MESSAGES[statusCode] ?? 'Too many requests';

  const response = exception.getResponse();
  if (typeof response === 'string') return response;

  const { message, error } = response as { message?: unknown; error?: unknown };
  // `new ForbiddenException()` has no `error` field; one given a message does. The route-not-found
  // and guard messages ("Cannot GET /x", "Forbidden resource") are Nest's too. Ours read better.
  const isNestDefault =
    typeof message !== 'string' ||
    error === undefined ||
    message.startsWith('Cannot ') ||
    message === 'Forbidden resource';
  return isNestDefault ? (GENERIC_MESSAGES[statusCode] ?? exception.message) : message;
}

function prismaClientError(exception: unknown): { status: number; message: string } | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { name, code, meta } = exception as { name?: unknown; code?: unknown; meta?: { driverAdapterError?: { cause?: { originalCode?: unknown } } } };
  if (name !== 'PrismaClientKnownRequestError' || typeof code !== 'string') return undefined;
  // A CHECK constraint (a balance going negative, say) means the record changed under the request
  if (meta?.driverAdapterError?.cause?.originalCode === CHECK_VIOLATION) {
    return { status: HttpStatus.CONFLICT, message: 'This conflicts with a change made just now. Reload and try again.' };
  }
  return PRISMA_CLIENT_ERRORS[code];
}
