import { Global, Injectable, Module } from '@nestjs/common';

const TTL_MS = 30_000;

/**
 * Dashboard results for 30 seconds per scope (plan §6). Writes that change what the dashboard counts
 * (employees, departments, attendance, leave) call `invalidate()`, so an HR user who adds someone sees
 * the new total at once rather than half a minute later.
 */
@Injectable()
export class DashboardCache {
  private readonly entries = new Map<string, { value: unknown; expires: number }>();

  async getOrCompute<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;
    const value = await compute();
    this.entries.set(key, { value, expires: Date.now() + TTL_MS });
    return value;
  }

  invalidate(): void {
    this.entries.clear();
  }
}

@Global()
@Module({ providers: [DashboardCache], exports: [DashboardCache] })
export class DashboardCacheModule {}
