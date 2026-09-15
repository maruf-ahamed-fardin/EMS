import type { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { HttpError, route } from '@/server/lib/http';

function call(handler: () => Response | Promise<Response>, headers: Record<string, string> = {}) {
  const request = new Request('http://localhost/api/test', { headers }) as unknown as NextRequest;
  return route(handler)(request, { params: Promise.resolve({}) });
}

describe('route', () => {
  it('makes responses private by default', async () => {
    const response = await call(() => Response.json({ ok: true }));
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('keeps a Cache-Control the handler set', async () => {
    const response = await call(() => Response.json({}, { headers: { 'Cache-Control': 'public, s-maxage=30' } }));
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=30');
  });

  it('echoes the request id from the proxy', async () => {
    const response = await call(() => new Response(null, { status: 204 }), { 'x-request-id': 'req-12345678' });
    expect(response.headers.get('X-Request-Id')).toBe('req-12345678');
  });

  it('turns HttpError into problem+json', async () => {
    const response = await call(() => {
      throw new HttpError(404, 'Not Found', 'No such member');
    });
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toBe('application/problem+json');
    expect(await response.json()).toEqual({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'No such member' });
  });

  it('turns validation failures into a 400 listing the fields', async () => {
    const response = await call(() => {
      z.object({ id: z.string().min(1) }).parse({ id: '' });
      return new Response();
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors).toEqual([expect.objectContaining({ path: 'id' })]);
  });

  it('hides unexpected errors behind a generic 500', async () => {
    const response = await call(() => {
      throw new Error('connect ECONNREFUSED mysql://app:secret@db');
    });
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('secret');
  });
});
