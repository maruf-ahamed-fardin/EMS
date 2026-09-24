import type { DocumentItem, DocumentTypeItem } from '@ems/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiRequestError } from '@/lib/api-error';
import { checkDocumentFile, documentsHref, formatBytes, titleFromFileName } from '@/lib/documents';
import { DocumentActions } from './document-actions';
import { DocumentList } from './document-list';
import { UploadDocumentDialog } from './upload-document-dialog';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));

const api = vi.fn();
const apiUpload = vi.fn();
vi.mock('@/lib/api-client', () => ({ api: (...args: unknown[]) => api(...args), apiUpload: (...args: unknown[]) => apiUpload(...args) }));
const download = vi.fn();
vi.mock('@/lib/documents', async (original) => ({ ...(await original<typeof import('@/lib/documents')>()), downloadDocument: (url: string) => download(url) }));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock('sonner', () => ({ toast: { success: (m: string) => toast.success(m), error: (m: string) => toast.error(m) } }));

beforeEach(() => {
  for (const mock of [api, apiUpload, download, refresh, toast.success, toast.error]) mock.mockReset();
});

const file = (name: string, size: number) => {
  const f = new File(['x'], name);
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

describe('document helpers', () => {
  it('formats sizes and turns a file name into a title', () => {
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(840 * 1024)).toBe('840 KB');
    expect(formatBytes(2.4 * 1024 * 1024)).toBe('2.4 MB');
    expect(titleFromFileName('passport-scan_2026.pdf')).toBe('passport scan 2026');
  });

  it('catches oversized, empty and unsupported files before uploading', () => {
    expect(checkDocumentFile(file('a.pdf', 1000))).toBeNull();
    expect(checkDocumentFile(file('photo.JPEG', 1000))).toBeNull();
    expect(checkDocumentFile(file('a.pdf', 0))).toBe('This file is empty');
    expect(checkDocumentFile(file('a.pdf', 11 * 1024 * 1024))).toBe('This file is 11.0 MB. The limit is 10.0 MB.');
    expect(checkDocumentFile(file('setup.exe', 1000))).toBe('Upload a PDF, PNG, JPEG or Word (.docx) file');
  });

  it('keeps filters in the URL and resets the page when one changes', () => {
    expect(documentsHref({ q: 'pass', page: '3' }, { expiry: 'EXPIRING' })).toBe('/documents?q=pass&expiry=EXPIRING');
    expect(documentsHref({ q: 'pass' }, { page: '2' })).toBe('/documents?q=pass&page=2');
  });
});

const passport: DocumentItem = {
  id: 'd1',
  employee: { id: 'e1', name: 'Rahim Ahmed', employeeCode: 'SX-004' },
  documentType: { id: 't1', name: 'Passport', isSensitive: true, hasExpiry: true },
  title: 'Passport',
  mimeType: 'application/pdf',
  sizeBytes: 245_000,
  expiresAt: '2026-10-01',
  expiry: 'EXPIRING',
  uploadedBy: 'Farhana Akter',
  uploadedAt: '2026-09-16T20:30:00.000Z',
  allowedActions: { delete: true },
};

describe('DocumentList', () => {
  it('shows type, expiry, size and who added it, in Dhaka time', () => {
    render(<DocumentList documents={[passport]} showEmployee />);
    expect(screen.getByText('Expires 1 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Expiring soon:')).toHaveClass('sr-only');
    expect(screen.getByLabelText('Sensitive')).toBeInTheDocument();
    // 20:30 UTC on the 16th is the 17th in Dhaka
    expect(screen.getByText(/PDF · 239 KB · added 17 Sep 2026 by Farhana Akter/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rahim Ahmed' })).toHaveAttribute('href', '/employees/e1?tab=documents');
    expect(screen.getByRole('button', { name: 'Delete Passport' })).toBeInTheDocument();
  });
});

describe('DocumentActions', () => {
  it('asks for a fresh link on click and opens it', async () => {
    api.mockResolvedValueOnce({ data: { url: '/api/v1/files/abc', expiresAt: '2026-09-17T04:01:00.000Z' } });
    render(<DocumentActions document={{ ...passport, allowedActions: { delete: false } }} />);
    expect(screen.queryByRole('button', { name: 'Delete Passport' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Download Passport' }));
    await waitFor(() => expect(download).toHaveBeenCalledWith('/api/v1/files/abc'));
    expect(api).toHaveBeenCalledWith('/documents/d1/url');
  });

  it('says so when the link is refused', async () => {
    api.mockRejectedValueOnce(new ApiRequestError(404, { message: 'Not found' }));
    render(<DocumentActions document={passport} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download Passport' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Not found'));
    expect(download).not.toHaveBeenCalled();
  });
});

const types: DocumentTypeItem[] = [
  { id: '0190a000-0000-7000-8000-000000000001', name: 'National ID', code: 'NATIONAL_ID', isSensitive: true, hasExpiry: false, documentCount: 0 },
  { id: '0190a000-0000-7000-8000-000000000002', name: 'Driving licence', code: 'DRIVING_LICENCE', isSensitive: false, hasExpiry: true, documentCount: 0 },
  { id: '0190a000-0000-7000-8000-000000000003', name: 'Contract', code: 'CONTRACT', isSensitive: false, hasExpiry: false, documentCount: 0 },
];

describe('UploadDocumentDialog', () => {
  const open = (props: Partial<React.ComponentProps<typeof UploadDocumentDialog>> = {}) => {
    render(<UploadDocumentDialog employeeId="e1" employeeName="Rahim Ahmed" types={types} canUploadSensitive={false} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Upload document' }));
  };

  it("doesn't offer private types to someone who couldn't open them, and asks for the expiry date", async () => {
    open();
    // The first type offered is the driving licence, which expires
    expect(await screen.findByRole('combobox')).toHaveTextContent('Driving licence');
    expect(screen.getByLabelText(/Expires on/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/File/), { target: { files: [new File(['%PDF-1.4'], 'licence-front.pdf', { type: 'application/pdf' })] } });
    expect(screen.getByLabelText(/Title/)).toHaveValue('licence front');
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByText('Driving licence documents need an expiry date')).toBeInTheDocument();
    expect(apiUpload).not.toHaveBeenCalled();
  });

  it('sends the file and fields as multipart form data', async () => {
    apiUpload.mockResolvedValueOnce({ data: passport });
    open();
    await screen.findByRole('combobox');
    const chosen = new File(['%PDF-1.4'], 'licence.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/File/), { target: { files: [chosen] } });
    fireEvent.change(screen.getByLabelText(/Expires on/), { target: { value: '2028-05-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));

    await waitFor(() => expect(apiUpload).toHaveBeenCalledTimes(1));
    const [path, form] = apiUpload.mock.calls[0] as [string, FormData];
    expect(path).toBe('/employees/e1/documents');
    expect(form.get('documentTypeId')).toBe(types[1]!.id);
    expect(form.get('title')).toBe('licence');
    expect(form.get('expiresAt')).toBe('2028-05-01');
    expect(form.get('file')).toBe(chosen);
    expect(toast.success).toHaveBeenCalledWith('licence added for Rahim Ahmed');
    expect(refresh).toHaveBeenCalled();
  });

  it('refuses a big file at once, and shows the server’s verdict on the bytes', async () => {
    open({ canUploadSensitive: true });
    await screen.findByRole('combobox');
    fireEvent.change(screen.getByLabelText(/File/), { target: { files: [file('scan.pdf', 12 * 1024 * 1024)] } });
    expect(screen.getByText('This file is 12.0 MB. The limit is 10.0 MB.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();

    apiUpload.mockRejectedValueOnce(new ApiRequestError(422, { message: 'Validation failed', errors: { file: 'Upload a PDF, PNG, JPEG or Word (.docx) file' } }));
    fireEvent.change(screen.getByLabelText(/File/), { target: { files: [new File(['MZ'], 'id.pdf')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByText('Upload a PDF, PNG, JPEG or Word (.docx) file')).toBeInTheDocument();
  });
});
