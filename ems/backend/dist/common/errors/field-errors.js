"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.zodIssuesToFieldErrors = zodIssuesToFieldErrors;
/**
 * `{ "address.city": "Required" }`: one message per field, the first zod reported. Forms show one
 * message under each input, so the rest would never be seen.
 */
function zodIssuesToFieldErrors(error) {
    const issues = error?.issues ?? [];
    const errors = {};
    for (const issue of issues) {
        const field = issue.path.map(String).join('.') || '_';
        errors[field] ??= issue.message;
    }
    return errors;
}
//# sourceMappingURL=field-errors.js.map