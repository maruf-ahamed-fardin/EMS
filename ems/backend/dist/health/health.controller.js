"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const CHECK_TIMEOUT_MS = 2000;
let HealthController = class HealthController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** Liveness: the process is up. Never touches dependencies, so a slow database can't restart it. */
    live() {
        return { status: 'ok' };
    }
    /** Readiness: dependencies answer. Storage joins the checks in Phase 8. */
    async ready(res) {
        const database = await withTimeout(this.prisma.$queryRaw `SELECT 1`, CHECK_TIMEOUT_MS)
            .then(() => 'ok')
            .catch(() => 'failed');
        const checks = { database };
        const healthy = Object.values(checks).every((result) => result === 'ok');
        if (!healthy)
            res.status(common_1.HttpStatus.SERVICE_UNAVAILABLE);
        return { status: healthy ? 'ok' : 'unavailable', checks };
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], HealthController.prototype, "live", null);
__decorate([
    (0, common_1.Get)('ready'),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "ready", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HealthController);
function withTimeout(promise, ms) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
//# sourceMappingURL=health.controller.js.map