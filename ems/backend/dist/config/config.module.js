"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigModule = exports.InjectConfig = exports.APP_CONFIG = void 0;
const common_1 = require("@nestjs/common");
const env_1 = require("./env");
exports.APP_CONFIG = Symbol('APP_CONFIG');
/** Injects the validated configuration: `constructor(@InjectConfig() config: AppConfig)`. */
const InjectConfig = () => (0, common_1.Inject)(exports.APP_CONFIG);
exports.InjectConfig = InjectConfig;
let ConfigModule = class ConfigModule {
};
exports.ConfigModule = ConfigModule;
exports.ConfigModule = ConfigModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [{ provide: exports.APP_CONFIG, useFactory: () => (0, env_1.parseEnv)() }],
        exports: [exports.APP_CONFIG],
    })
], ConfigModule);
//# sourceMappingURL=config.module.js.map