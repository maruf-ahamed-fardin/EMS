import type { ReportCell } from '@ems/contracts';
import PDFDocument from 'pdfkit';
import type { ReportDocument, ReportWriter, Sink } from './sink';

const MARGIN = 36;
const ROW_HEIGHT = 15;
const FONT_SIZE = 8.5;
/** Windows-1252, what the built-in PDF fonts can draw. */
const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/**
 * The built-in Helvetica can only draw Latin text. Anything else (a Bangla name, an emoji) becomes "?"
 * rather than garbage; the CSV and XLSX versions keep the exact text.
 */
export function pdfSafe(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0)!;
    out += (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(char) ? char : code < 0x20 ? ' ' : '?';
  }
  return out;
}

/**
 * A PDF table (landscape A4) with the title, filters and totals on the first page, the header row
 * repeated on every page and page numbers. Pages are written out as they fill, not held in memory.
 */
export class PdfWriter implements ReportWriter {
  readonly contentType = 'application/pdf';
  readonly extension = 'pdf';
  private readonly doc: PDFKit.PDFDocument;
  private document?: ReportDocument;
  private widths: number[] = [];
  private y = 0;
  private page = 0;
  private zebra = false;

  constructor(private readonly sink: Sink) {
    // A small bottom margin, so the footer line sits inside the page and never starts a new one
    this.doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: 12 }, bufferPages: false, autoFirstPage: false });
    this.doc.pipe(sink.stream);
  }

  private get bottom(): number {
    return this.doc.page.height - MARGIN - 18;
  }

  private newPage(): void {
    this.doc.addPage();
    this.page++;
    const d = this.document!;
    this.doc.font('Helvetica').fontSize(7.5).fillColor('#6b7280');
    this.doc.text(pdfSafe(`${d.title} · generated ${d.generatedAt} · page ${this.page}`), MARGIN, this.doc.page.height - 26, { lineBreak: false });
    this.y = MARGIN;
  }

  /** Text cut to the column width with an ellipsis, so every row stays one line high. */
  private fit(text: string, width: number): string {
    const available = width - 6;
    if (this.doc.widthOfString(text) <= available) return text;
    let low = 0;
    let high = text.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (this.doc.widthOfString(`${text.slice(0, mid)}…`) <= available) low = mid;
      else high = mid - 1;
    }
    return `${text.slice(0, low)}…`;
  }

  private drawRow(values: ReportCell[], header: boolean): void {
    const d = this.document!;
    if (header || this.zebra) {
      this.doc.rect(MARGIN, this.y, this.doc.page.width - MARGIN * 2, ROW_HEIGHT).fill(header ? '#ede9fe' : '#f8fafc');
    }
    this.doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SIZE).fillColor('#111827');
    let x = MARGIN;
    values.forEach((value, i) => {
      const width = this.widths[i]!;
      const text = this.fit(pdfSafe(value === null ? '' : String(value)), width);
      const numeric = !header && d.columns[i]?.numeric;
      this.doc.text(text, x + 3, this.y + 4, { width: width - 6, align: numeric ? 'right' : 'left', lineBreak: false });
      x += width;
    });
    this.y += ROW_HEIGHT;
    if (!header) this.zebra = !this.zebra;
  }

  private header(): void {
    this.zebra = false;
    this.drawRow(
      this.document!.columns.map((c) => c.label),
      true,
    );
  }

  async start(document: ReportDocument): Promise<void> {
    this.document = document;
    this.newPage();
    const usable = this.doc.page.width - MARGIN * 2;
    const total = document.columns.reduce((sum, c) => sum + c.width, 0);
    this.widths = document.columns.map((c) => (c.width / total) * usable);

    const doc = this.doc;
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(pdfSafe(`${document.title} report`), MARGIN, this.y);
    doc.font('Helvetica').fontSize(9).fillColor('#4b5563');
    doc.text(pdfSafe(`Generated ${document.generatedAt}. ${document.filters.length > 0 ? document.filters.join(' · ') : 'No filters.'}`), { width: usable });
    doc.moveDown(0.6);
    const figures = document.summary.figures.map((f) => `${f.label}: ${f.value}`).join('     ');
    if (figures) doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(pdfSafe(figures), { width: usable });
    for (const section of document.summary.sections) {
      doc.font('Helvetica').fontSize(8.5).fillColor('#374151').text(pdfSafe(`${section.title}: ${section.rows.map((r) => `${r.label} ${r.value}`).join(', ')}`), { width: usable });
    }
    this.y = doc.y + 12;
    this.header();
    await this.sink.drained();
  }

  async rows(rows: ReportCell[][]): Promise<void> {
    for (const values of rows) {
      if (this.y + ROW_HEIGHT > this.bottom) {
        this.newPage();
        this.header();
      }
      this.drawRow(values, false);
    }
    // pdfkit doesn't wait for a slow reader itself; wait here, between batches
    await this.sink.drained();
  }

  async end(): Promise<void> {
    const finished = new Promise<void>((resolve, reject) => {
      this.sink.stream.once('finish', resolve);
      this.doc.once('error', reject);
    });
    this.doc.end();
    await finished;
  }
}
