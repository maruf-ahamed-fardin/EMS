import { PassThrough } from 'node:stream';
import { crc32, inflateRawSync } from 'node:zlib';
import type { ReportCell } from '@/lib/validations';
import { stamp } from '../reports.service';
import { CsvWriter, csvCell } from './csv';
import { PdfWriter, pdfSafe } from './pdf';
import { type ReportDocument, type ReportWriter, Sink } from './sink';
import { columnName, XlsxWriter, xmlText } from './xlsx';

const document: ReportDocument = {
  title: 'Attendance',
  filters: ['Dates: 2026-09-01 to 2026-09-30'],
  generatedAt: '19 Sep 2026, 14:32',
  columns: [
    { key: 'name', label: 'Name', width: 20 },
    { key: 'hours', label: 'Hours', width: 8, numeric: true },
  ],
  summary: { figures: [{ label: 'Present rate', value: '94%' }], sections: [{ title: 'By status', rows: [{ label: 'Late', value: 3 }] }] },
};

/** Runs a writer over the rows and returns everything it wrote. */
async function produce(make: (sink: Sink) => ReportWriter, batches: ReportCell[][][]): Promise<Buffer> {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (c: Buffer) => chunks.push(c));
  const writer = make(new Sink(stream));
  await writer.start(document);
  for (const batch of batches) await writer.rows(batch);
  await writer.end();
  if (!stream.writableEnded) stream.end();
  return Buffer.concat(chunks);
}

/** Reads a zip back: every entry's name and content, with its CRC checked. */
function unzip(zip: Buffer): Map<string, string> {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const files = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    expect(zip.readUInt32LE(offset)).toBe(0x02014b50);
    const crc = zip.readUInt32LE(offset + 16);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const local = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    const localNameLength = zip.readUInt16LE(local + 26);
    const data = inflateRawSync(zip.subarray(local + 30 + localNameLength, local + 30 + localNameLength + compressedSize));
    expect(crc32(data)).toBe(crc);
    files.set(name, data.toString('utf8'));
    offset += 46 + nameLength;
  }
  return files;
}

describe('CSV', () => {
  it('quotes where needed and keeps numbers as numbers', () => {
    expect(csvCell('Rahim Ahmed')).toBe('Rahim Ahmed');
    expect(csvCell('Ahmed, Rahim')).toBe('"Ahmed, Rahim"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(7.5)).toBe('7.5');
    expect(csvCell(-3)).toBe('-3');
    expect(csvCell(null)).toBe('');
  });

  it("stops a cell from running as a spreadsheet formula", () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('writes a byte-order mark, the header and CRLF rows', async () => {
    const out = (await produce((s) => new CsvWriter(s), [[['Rahim', 8.5]], [['রহিম', null]]])).toString('utf8');
    expect(out).toBe('\uFEFFName,Hours\r\nRahim,8.5\r\nরহিম,\r\n');
  });
});

describe('XLSX', () => {
  it('names columns like Excel', () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA']);
  });

  it('escapes text and drops characters XML forbids', () => {
    expect(xmlText('a < b & "c" > d')).toBe('a &lt; b &amp; &quot;c&quot; &gt; d');
    expect(xmlText('tab\tok\u0001gone\u0008')).toBe('tab\tokgone');
  });

  it('writes a complete workbook whose parts read back intact', async () => {
    const rows: ReportCell[][] = Array.from({ length: 5000 }, (_, i) => [`Person ${i} & <co>`, i / 2]);
    const zip = await produce((s) => new XlsxWriter(s), [rows.slice(0, 2000), rows.slice(2000)]);
    const files = unzip(zip);
    expect([...files.keys()].sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ]);
    const sheet = files.get('xl/worksheets/sheet1.xml')!;
    expect(sheet.startsWith('<?xml')).toBe(true);
    expect(sheet.endsWith('</sheetData></worksheet>')).toBe(true);
    expect(sheet).toContain('<row r="1"><c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Name</t></is></c>');
    expect(sheet).toContain('<row r="5001"><c r="A5001" t="inlineStr"><is><t xml:space="preserve">Person 4999 &amp; &lt;co&gt;</t></is></c><c r="B5001"><v>2499.5</v></c></row>');
    expect(sheet.match(/<row /g)).toHaveLength(5001);
    const about = files.get('xl/worksheets/sheet2.xml')!;
    expect(about).toContain('Present rate');
    expect(about).toContain('<v>5000</v>');
    expect(files.get('xl/workbook.xml')).toContain('<sheet name="Attendance" sheetId="1" r:id="rId1"/>');
  });
});

describe('PDF', () => {
  it('keeps what Helvetica can draw and marks the rest', () => {
    expect(pdfSafe('Café – “quoted” €5')).toBe('Café – “quoted” €5');
    expect(pdfSafe('রহিম Ahmed')).toBe('???? Ahmed');
    expect(pdfSafe('line\nbreak')).toBe('line break');
  });

  it('writes a PDF with a page per ~30 rows', async () => {
    const rows: ReportCell[][] = Array.from({ length: 200 }, (_, i) => [`Person ${i}`, i]);
    const pdf = await produce((s) => new PdfWriter(s), [rows.slice(0, 100), rows.slice(100)]);
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const pages = Number(/\/Type \/Pages\s*\/Count (\d+)/.exec(text)?.[1]);
    expect(pages).toBeGreaterThanOrEqual(6);
    expect(pages).toBeLessThanOrEqual(9);
  });

  it('stops producing, and never hangs, once the client has gone', async () => {
    const rows: ReportCell[][] = Array.from({ length: 50 }, (_, i) => [`Person ${i}`, i]);
    const stream = new PassThrough();
    stream.resume();
    const writer = new PdfWriter(new Sink(stream));
    await writer.start(document);
    await writer.rows(rows);
    stream.destroy();
    await expect(writer.rows(rows)).rejects.toThrow('The client closed the connection');
    await expect(writer.end()).rejects.toThrow('The client closed the connection');
  });
});

it('stamps the time in the organization time zone', () => {
  expect(stamp(new Date('2026-09-19T08:32:00Z'), 'Asia/Dhaka')).toBe('19 Sep 2026, 14:32');
});
