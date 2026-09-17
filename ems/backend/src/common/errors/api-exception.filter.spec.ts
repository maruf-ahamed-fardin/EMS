import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';
import { ApiExceptionFilter } from './api-exception.filter';

const filter = new ApiExceptionFilter();
const convert = (error: unknown) => filter.toApiError(error, 'req-12345678');

describe('ApiExceptionFilter', () => {
  it('maps zod validation to 422 with one message per field', () => {
    const schema = z.object({ email: z.email(), address: z.object({ city: z.string().min(1) }) });
    const result = schema.safeParse({ email: 'nope', address: { city: '' } });
    if (result.success) throw new Error('expected failure');

    const body = convert(new ZodValidationException(result.error));
    expect(body.statusCode).toBe(422);
    expect(body.message).toBe('Validation failed');
    expect(Object.keys(body.errors ?? {}).sort()).toEqual(['address.city', 'email']);
    expect(body.requestId).toBe('req-12345678');
  });

  it('keeps a deliberate HttpException message', () => {
    expect(convert(new ConflictException('Department still has 3 active employees'))).toEqual({
      statusCode: 409,
      message: 'Department still has 3 active employees',
      requestId: 'req-12345678',
    });
  });

  it("replaces Nest's default messages", () => {
    expect(convert(new NotFoundException('Cannot GET /api/v1/nope')).message).toBe('Not found');
    expect(convert(new ForbiddenException()).message).toBe("You don't have access to this");
    expect(convert(new BadRequestException()).message).toBe('Bad Request');
  });

  it('maps Prisma client errors by code', () => {
    const unique = Object.assign(new Error('Unique constraint failed on the fields: (`email`)'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
    });
    expect(convert(unique)).toMatchObject({ statusCode: 409, message: 'A record with these details already exists' });
  });

  it('hides the details of unexpected errors', () => {
    const body = convert(new Error('connect ECONNREFUSED postgresql://ems:secret@db/ems'));
    expect(body).toEqual({ statusCode: 500, message: 'Something went wrong', requestId: 'req-12345678' });
  });
});
