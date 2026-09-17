import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { HealthResponse, ReadinessResponse } from '@ems/contracts';
import type { Response } from 'express';
import { Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';

const CHECK_TIMEOUT_MS = 2000;

@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. Never touches dependencies, so a slow database can't restart it. */
  @Get()
  live(): HealthResponse {
    return { status: 'ok' };
  }

  /** Readiness: dependencies answer. Storage joins the checks in Phase 8. */
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response): Promise<ReadinessResponse> {
    const database = await withTimeout(this.prisma.$queryRaw`SELECT 1`, CHECK_TIMEOUT_MS)
      .then(() => 'ok' as const)
      .catch(() => 'failed' as const);

    const checks = { database };
    const healthy = Object.values(checks).every((result) => result === 'ok');
    if (!healthy) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: healthy ? 'ok' : 'unavailable', checks };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
