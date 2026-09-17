"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginationQuery = exports.MAX_PAGE_LIMIT = void 0;
exports.pageMeta = pageMeta;
const zod_1 = require("zod");
exports.MAX_PAGE_LIMIT = 100;
exports.paginationQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(exports.MAX_PAGE_LIMIT).default(20),
});
function pageMeta(page, limit, total) {
    return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
//# sourceMappingURL=api.js.map