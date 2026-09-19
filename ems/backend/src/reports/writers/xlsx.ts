import { once } from 'node:events';
import { crc32, createDeflateRaw, deflateRawSync } from 'node:zlib';
import type { ReportCell } from '@ems/contracts';
import type { ReportDocument, ReportWriter, Sink } from './sink';

// ─── A streaming zip (what an .xlsx file is) ───────────────────────────────────────────────────

interface ZipEntry {
  name: Buffer;
  crc: number;
  compressedSize: number;
  size: number;
  offset: number;
  flags: number;
}

const UTF8_NAMES = 0x0800;
const DATA_DESCRIPTOR = 0x0008;

/** DOS date and time, as zip headers store them. */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/**
 * Writes zip entries straight to the sink: small files whole, and one large file deflated as it is
 * produced, with its sizes in a data descriptor afterwards. No zip64: reports are capped far below 4 GB.
 */
class ZipStream {
  private readonly entries: ZipEntry[] = [];
  private offset = 0;
  private readonly stamp = dosDateTime(new Date());

  constructor(private readonly sink: Sink) {}

  private async out(chunk: Buffer): Promise<void> {
    this.offset += chunk.length;
    await this.sink.write(chunk);
  }

  private localHeader(name: Buffer, flags: number, crc: number, compressedSize: number, size: number): Buffer {
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(flags, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(this.stamp.time, 10);
    header.writeUInt16LE(this.stamp.date, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressedSize, 18);
    header.writeUInt32LE(size, 22);
    header.writeUInt16LE(name.length, 26);
    return Buffer.concat([header, name]);
  }

  async file(path: string, content: string): Promise<void> {
    const name = Buffer.from(path, 'utf8');
    const data = Buffer.from(content, 'utf8');
    const compressed = deflateRawSync(data);
    const entry = { name, crc: crc32(data), compressedSize: compressed.length, size: data.length, offset: this.offset, flags: UTF8_NAMES };
    this.entries.push(entry);
    await this.out(this.localHeader(name, entry.flags, entry.crc, entry.compressedSize, entry.size));
    await this.out(compressed);
  }

  /** A file written piece by piece; call `write` for each piece, then `end`. */
  async open(path: string): Promise<{ write: (text: string) => Promise<void>; end: () => Promise<void> }> {
    const name = Buffer.from(path, 'utf8');
    const entry: ZipEntry = { name, crc: 0, compressedSize: 0, size: 0, offset: this.offset, flags: UTF8_NAMES | DATA_DESCRIPTOR };
    this.entries.push(entry);
    await this.out(this.localHeader(name, entry.flags, 0, 0, 0));

    const deflate = createDeflateRaw({ level: 6 });
    const produced: Buffer[] = [];
    deflate.on('data', (chunk: Buffer) => produced.push(chunk));
    const flush = async () => {
      while (produced.length > 0) {
        const chunk = produced.shift()!;
        entry.compressedSize += chunk.length;
        await this.out(chunk);
      }
    };

    return {
      write: async (text: string) => {
        const data = Buffer.from(text, 'utf8');
        entry.crc = crc32(data, entry.crc);
        entry.size += data.length;
        if (!deflate.write(data)) await once(deflate, 'drain');
        await flush();
      },
      end: async () => {
        const ended = once(deflate, 'end');
        deflate.end();
        await ended;
        await flush();
        const descriptor = Buffer.alloc(16);
        descriptor.writeUInt32LE(0x08074b50, 0);
        descriptor.writeUInt32LE(entry.crc, 4);
        descriptor.writeUInt32LE(entry.compressedSize, 8);
        descriptor.writeUInt32LE(entry.size, 12);
        await this.out(descriptor);
      },
    };
  }

  async finish(): Promise<void> {
    const start = this.offset;
    for (const e of this.entries) {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(20, 4);
      header.writeUInt16LE(20, 6);
      header.writeUInt16LE(e.flags, 8);
      header.writeUInt16LE(8, 10);
      header.writeUInt16LE(this.stamp.time, 12);
      header.writeUInt16LE(this.stamp.date, 14);
      header.writeUInt32LE(e.crc, 16);
      header.writeUInt32LE(e.compressedSize, 20);
      header.writeUInt32LE(e.size, 24);
      header.writeUInt16LE(e.name.length, 28);
      header.writeUInt32LE(e.offset, 42);
      await this.out(Buffer.concat([header, e.name]));
    }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(this.entries.length, 8);
    end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(this.offset - start, 12);
    end.writeUInt32LE(start, 16);
    await this.out(end);
  }
}

// ─── SpreadsheetML ──────────────────────────────────────────────────────────────────────────────

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Text safe inside XML: escaped, and without the control characters XML 1.0 forbids. */
export function xmlText(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) continue;
    if (code === 0xfffe || code === 0xffff) continue;
    out += char === '&' ? '&amp;' : char === '<' ? '&lt;' : char === '>' ? '&gt;' : char === '"' ? '&quot;' : char;
  }
  return out;
}

/** 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

function cell(ref: string, value: ReportCell, style = 0): string {
  const s = style ? ` s="${style}"` : '';
  if (value === null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`;
  // Inline strings are never evaluated, so a name starting with "=" is harmless here
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlText(String(value))}</t></is></c>`;
}

function row(index: number, values: ReportCell[], style = 0): string {
  return `<row r="${index}">${values.map((v, i) => cell(`${columnName(i)}${index}`, v, style)).join('')}</row>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${REL}/styles" Target="styles.xml"/></Relationships>`;

/** Two cell styles: 0 normal, 1 bold. */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${MAIN}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

/** Excel's sheet names: at most 31 characters, none of []:*?/\ */
function sheetName(title: string): string {
  return title.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Report';
}

/**
 * XLSX without a library: a zip of a few XML files, built as it streams. Sheet 1 is the table (bold,
 * frozen header row, numbers as numbers); sheet 2, "About", has the title, filters and totals.
 */
export class XlsxWriter implements ReportWriter {
  readonly contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  readonly extension = 'xlsx';
  private readonly zip: ZipStream;
  private sheet?: Awaited<ReturnType<ZipStream['open']>>;
  private document?: ReportDocument;
  private next = 2;

  constructor(sink: Sink) {
    this.zip = new ZipStream(sink);
  }

  async start(document: ReportDocument): Promise<void> {
    this.document = document;
    await this.zip.file('[Content_Types].xml', CONTENT_TYPES);
    await this.zip.file('_rels/.rels', ROOT_RELS);
    await this.zip.file(
      'xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets><sheet name="${xmlText(sheetName(document.title))}" sheetId="1" r:id="rId1"/><sheet name="About" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    );
    await this.zip.file('xl/_rels/workbook.xml.rels', WORKBOOK_RELS);
    await this.zip.file('xl/styles.xml', STYLES);

    this.sheet = await this.zip.open('xl/worksheets/sheet1.xml');
    const cols = document.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`).join('');
    await this.sheet.write(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="${MAIN}" xmlns:r="${REL}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${row(1, document.columns.map((c) => c.label), 1)}`,
    );
  }

  async rows(rows: ReportCell[][]): Promise<void> {
    await this.sheet!.write(rows.map((values) => row(this.next++, values)).join(''));
  }

  async end(): Promise<void> {
    await this.sheet!.write('</sheetData></worksheet>');
    await this.sheet!.end();

    const d = this.document!;
    const lines: Array<{ values: ReportCell[]; bold?: boolean }> = [
      { values: [d.title], bold: true },
      { values: ['Generated', d.generatedAt] },
      { values: ['Rows', this.next - 2] },
      { values: [] },
      { values: ['Filters'], bold: true },
      ...(d.filters.length > 0 ? d.filters.map((f) => ({ values: [f] as ReportCell[] })) : [{ values: ['None'] as ReportCell[] }]),
      { values: [] },
      { values: ['Summary'], bold: true },
      ...d.summary.figures.map((f) => ({ values: [f.label, f.value] })),
      ...d.summary.sections.flatMap((s) => [{ values: [] }, { values: [s.title], bold: true }, ...s.rows.map((r) => ({ values: [r.label, r.value] }))]),
    ];
    await this.zip.file(
      'xl/worksheets/sheet2.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="${MAIN}"><cols><col min="1" max="1" width="40" customWidth="1"/><col min="2" max="2" width="24" customWidth="1"/></cols><sheetData>${lines.map((l, i) => row(i + 1, l.values, l.bold ? 1 : 0)).join('')}</sheetData></worksheet>`,
    );
    await this.zip.finish();
  }
}
