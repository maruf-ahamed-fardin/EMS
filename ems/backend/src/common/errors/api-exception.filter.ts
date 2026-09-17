import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ApiError } from '@ems/contracts';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { currentRequest } from '../request-context';
import { zodIssuesToFieldErrors } from './field-errors';

const GENERIC_MESSAGES: Partial<Record<number, string>> = {
  [HttpStatus.UNAUTHORIZED]: 'You need to sign in',
  [HttpStatus.FORBIDDEN]: "You don't have access to this",
  [HttpStatus.NOT_FOUND]: 'Not found',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests. Try again shortly.',
};

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
        { err: exception, requestId, method: req.method, url: req.originalUrl },
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
      return { statusCode, message: httpExceptionMessage(exception, statusCode), requestId };
    }

    const prisma = prismaClientError(exception);
    if (prisma) return { statusCode: prisma.status, message: prisma.message, requestId };

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Something went wrong', requestId };
  }
}

function httpExceptionMessage(exception: HttpException, statusCode: number): string {
  if (statusCode >= 500) return 'Something went wrong';

  const response = exception.getResponse();
  const detail =
    typeof response === 'string'
      ? response
      : typeof (response as { message?: unknown }).message === 'string'
        ? (response as { message: string }).message
        : undefined;

  // Nest's own defaults ("Cannot GET /x", "Forbidden resource") read poorly; ours replace them.
  const isNestDefault = !detail || detail.startsWith('Cannot ') || detail === exception.name || detail === 'Forbidden resource';
  return isNestDefault ? (GENERIC_MESSAGES[statusCode] ?? exception.message) : detail;
}

function prismaClientError(exception: unknown): { status: number; message: string } | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { name, code } = exception as { name?: unknown; code?: unknown };
  if (name !== 'PrismaClientKnownRequestError' || typeof code !== 'string') return undefined;
  return PRISMA_CLIENT_ERRORS[code];
}
