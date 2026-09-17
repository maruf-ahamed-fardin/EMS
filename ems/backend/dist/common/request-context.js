"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentRequest = currentRequest;
exports.runWithContext = runWithContext;
exports.resolveRequestId = resolveRequestId;
exports.requestContextMiddleware = requestContextMiddleware;
const node_async_hooks_1 = require("node:async_hooks");
const uuid_1 = require("uuid");
const storage = new node_async_hooks_1.AsyncLocalStorage();
/** The current request's context, or undefined outside a request (jobs, bootstrap). */
function currentRequest() {
    return storage.getStore();
}
function runWithContext(context, fn) {
    return storage.run(context, fn);
}
// A caller-supplied id is reused so a trace can cross the Next.js proxy, but only when it looks
// like an id: it goes into logs and response headers.
const ACCEPTABLE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;
function resolveRequestId(header) {
    const candidate = Array.isArray(header) ? header[0] : header;
    return candidate && ACCEPTABLE_REQUEST_ID.test(candidate) ? candidate : (0, uuid_1.v7)();
}
/**
 * First middleware on every request: assigns the request id (pino-http reuses `req.id`), echoes it
 * back, marks API responses as uncacheable and opens the AsyncLocalStorage context that the logger,
 * error filter and (later) audit log read.
 */
function requestContextMiddleware(req, res, next) {
    const requestId = resolveRequestId(req.headers['x-request-id']);
    req.id = requestId;
    res.setHeader('x-request-id', requestId);
    // Everything behind the API is per-user or operational. Routes that are safe to cache opt in.
    res.setHeader('cache-control', 'private, no-store');
    runWithContext({ requestId, ip: req.ip, userAgent: req.get('user-agent') }, next);
}
//# sourceMappingURL=request-context.js.map