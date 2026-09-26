import type { ReportCell } from '@/lib/validations';
import type { ReportDocument, ReportWriter, Sink } from './sink';

/**
 * A text cell that a spreadsheet would run as a formula (`=`, `+`, `-`, `@`, tab or carriage return
 * first) gets a leading apostrophe, so an employee named "=HYPERLINK(...)" stays text (CSV injection).
 */
export function csvCell(value: ReportCell): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/**
 * RFC 4180 CSV with a UTF-8 byte-order mark (so Excel reads Bangla names correctly) and CRLF line ends.
 * The table only: filters and totals are in the XLSX and PDF versions.
 */
export class CsvWriter implements ReportWriter {
  readonly contentType = 'text/csv; charset=utf-8';
  readonly extension = 'csv';

  constructor(private readonly sink: Sink) {}

  async start(document: ReportDocument): Promise<void> {
    await this.sink.write(`\uFEFF${document.columns.map((c) => csvCell(c.label)).join(',')}\r\n`);
  }

  async rows(rows: ReportCell[][]): Promise<void> {
    await this.sink.write(rows.map((row) => `${row.map(csvCell).join(',')}\r\n`).join(''));
  }

  async end(): Promise<void> {
    await this.sink.drained();
  }
}
