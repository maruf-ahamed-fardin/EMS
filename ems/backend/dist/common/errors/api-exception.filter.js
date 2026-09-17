"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const nestjs_zod_1 = require("nestjs-zod");
const request_context_1 = require("../request-context");
const field_errors_1 = require("./field-errors");
const GENERIC_MESSAGES = {
    [common_1.HttpStatus.UNAUTHORIZED]: 'You need to sign in',
    [common_1.HttpStatus.FORBIDDEN]: "You don't have access to this",
    [common_1.HttpStatus.NOT_FOUND]: 'Not found',
    [common_1.HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests. Try again shortly.',
};
/** Prisma error codes that describe the request rather than a server fault. */
const PRISMA_CLIENT_ERRORS = {
    P2002: { status: common_1.HttpStatus.CONFLICT, message: 'A record with these details already exists' },
    P2025: { status: common_1.HttpStatus.NOT_FOUND, message: 'Not found' },
};
/**
 * Turns every thrown error into the spec §35 shape. 500s never expose the underlying message or
 * stack; the requestId ties the response to the log line that has them.
 */
let ApiExceptionFilter = class ApiExceptionFilter {
    logger = new common_1.Logger('ApiExceptionFilter');
    catch(exception, host) {
        const http = host.switchToHttp();
        const req = http.getRequest();
        const res = http.getResponse();
        const requestId = (0, request_context_1.currentRequest)()?.requestId ?? req.id ?? 'unknown';
        const body = this.toApiError(exception, requestId);
        if (body.statusCode >= 500) {
            this.logger.error({ err: exception, requestId, method: req.method, url: req.originalUrl }, 'Unhandled error');
        }
        if (!res.headersSent)
            res.status(body.statusCode).json(body);
    }
    toApiError(exception, requestId) {
        if (exception instanceof nestjs_zod_1.ZodValidationException) {
            return {
                statusCode: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
                message: 'Validation failed',
                errors: (0, field_errors_1.zodIssuesToFieldErrors)(exception.getZodError()),
                requestId,
            };
        }
        if (exception instanceof common_1.HttpException) {
            const statusCode = exception.getStatus();
            return { statusCode, message: httpExceptionMessage(exception, statusCode), requestId };
        }
        const prisma = prismaClientError(exception);
        if (prisma)
            return { statusCode: prisma.status, message: prisma.message, requestId };
        return { statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR, message: 'Something went wrong', requestId };
    }
};
exports.ApiExceptionFilter = ApiExceptionFilter;
exports.ApiExceptionFilter = ApiExceptionFilter = __decorate([
    (0, common_1.Catch)()
], ApiExceptionFilter);
function httpExceptionMessage(exception, statusCode) {
    if (statusCode >= 500)
        return 'Something went wrong';
    const response = exception.getResponse();
    if (typeof response === 'string')
        return response;
    const { message, error } = response;
    // `new ForbiddenException()` has no `error` field; one given a message does. The route-not-found
    // and guard messages ("Cannot GET /x", "Forbidden resource") are Nest's too. Ours read better.
    const isNestDefault = typeof message !== 'string' ||
        error === undefined ||
        message.startsWith('Cannot ') ||
        message === 'Forbidden resource';
    return isNestDefault ? (GENERIC_MESSAGES[statusCode] ?? exception.message) : message;
}
function prismaClientError(exception) {
    if (typeof exception !== 'object' || exception === null)
        return undefined;
    const { name, code } = exception;
    if (name !== 'PrismaClientKnownRequestError' || typeof code !== 'string')
        return undefined;
    return PRISMA_CLIENT_ERRORS[code];
}
//# sourceMappingURL=api-exception.filter.js.map