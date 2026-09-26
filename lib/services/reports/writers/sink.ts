import { once } from 'node:events';
import type { Writable } from 'node:stream';
import type { ReportCell, ReportColumn, ReportSummary } from '@/lib/validations';

/** Everything a writer needs besides the rows. */
export interface ReportDocument {
  title: string;
  filters: string[];
  /** When it was made, already in the organization's time zone: "19 Sep 2026, 14:32". */
  generatedAt: string;
  columns: Array<ReportColumn & { width: number }>;
  summary: ReportSummary;
}

/** Writes a report in one file format. `rows` is called once per batch, in order. */
export interface ReportWriter {
  readonly contentType: string;
  readonly extension: string;
  start(document: ReportDocument): Promise<void>;
  rows(rows: ReportCell[][]): Promise<void>;
  end(): Promise<void>;
}

/**
 * A response that waits when the client reads slower than the report is made, so memory stays flat
 * however many rows there are. Rejects if the client goes away.
 */
export class Sink {
  constructor(private readonly out: Writable) {}

  async write(chunk: Buffer | string): Promise<void> {
    if (this.out.destroyed) throw new Error('The client closed the connection');
    if (!this.out.write(chunk)) await this.drained();
  }

  /**
   * Waits until earlier writes are flushed; rejects once the client has gone. The check comes first
   * because a destroyed stream reports no pending drain, which would let a writer keep producing.
   */
  async drained(): Promise<void> {
    if (this.out.destroyed) throw new Error('The client closed the connection');
    if (!this.out.writableNeedDrain) return;
    await Promise.race([once(this.out, 'drain'), once(this.out, 'close').then(() => Promise.reject(new Error('The client closed the connection')))]);
  }

  get stream(): Writable {
    return this.out;
  }
}
