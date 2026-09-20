import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

/** 422 with messages attached to form fields: `{ errors: { positionId: "…" } }`. */
export function invalidFields(errors: Record<string, string>, message = 'Validation failed') {
  return new UnprocessableEntityException({ message, error: 'Unprocessable Entity', errors });
}

/** 409 for a rule that blocks the change, optionally naming the fields involved. */
export function conflict(message: string, errors?: Record<string, string>) {
  return new ConflictException({ message, error: 'Conflict', ...(errors ? { errors } : {}) });
}
