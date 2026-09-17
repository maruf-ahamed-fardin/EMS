"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const nestjs_pino_1 = require("nestjs-pino");
const app_module_1 = require("./app.module");
const config_module_1 = require("./config/config.module");
const configure_app_1 = require("./configure-app");
const env_1 = require("./config/env");
async function bootstrap() {
    // Local development reads ../.env; containers and CI pass real environment variables.
    try {
        process.loadEnvFile('../.env');
    }
    catch {
        // no .env file
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bufferLogs: true });
    app.useLogger(app.get(nestjs_pino_1.Logger));
    const config = app.get(config_module_1.APP_CONFIG);
    (0, configure_app_1.configureApp)(app, config);
    await app.listen(config.PORT);
    app.get(nestjs_pino_1.Logger).log(`API listening on http://localhost:${config.PORT}/api/v1`, 'Bootstrap');
}
bootstrap().catch((error) => {
    // The logger may not exist yet, and InvalidEnvironmentError messages are safe to print.
    const message = error instanceof env_1.InvalidEnvironmentError ? error.message : error;
    console.error(message);
    process.exit(1);
});
//# sourceMappingURL=main.js.map