"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_PREFIX = void 0;
exports.configureApp = configureApp;
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const request_context_1 = require("./common/request-context");
exports.API_PREFIX = 'api/v1';
/** Everything main.ts sets up on the app, shared with the e2e tests so they exercise the same stack. */
function configureApp(app, config) {
    app.use(request_context_1.requestContextMiddleware);
    app.set('trust proxy', config.TRUST_PROXY_HOPS);
    app.disable('x-powered-by');
    app.use((0, helmet_1.default)());
    app.use((0, cookie_parser_1.default)());
    app.useBodyParser('json', { limit: '1mb' });
    app.setGlobalPrefix(exports.API_PREFIX);
    app.enableCors(config.CORS_ORIGINS.length > 0 ? { origin: config.CORS_ORIGINS, credentials: true } : { origin: false });
    app.enableShutdownHooks();
}
//# sourceMappingURL=configure-app.js.map