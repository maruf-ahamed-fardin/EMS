import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import {
  Body,
  type CallHandler,
  Controller,
  Delete,
  type ExecutionContext,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Injectable,
  Module,
  type NestInterceptor,
  NotFoundException,
  Param,
  Patch,
  PayloadTooLargeException,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  createDocumentTypeInput,
  type DataResponse,
  type DocumentItem,
  documentListQuery,
  type DocumentTypeItem,
  type DocumentUrl,
  type ListResponse,
  MAX_DOCUMENT_BYTES,
  type UploadDocumentFields,
  updateDocumentTypeInput,
} from '@ems/contracts';
import type { Request, Response } from 'express';
import { catchError, from, mergeMap, type Observable, throwError } from 'rxjs';
import { createZodDto } from 'nestjs-zod';
import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth, Public, RequirePermission } from '../auth/decorators';
import { Clock } from '../common/clock';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { DocumentExpiryReminders } from './document-expiry';
import { DocumentTypesService } from './document-types.service';
import { DocumentsService, type UploadedDocumentFile } from './documents.service';
import { contentDisposition, createDocumentStorage, DOCUMENT_STORAGE, type DocumentStorage, LocalDocumentStorage } from './storage/storage';

/** Room for the text fields and multipart boundaries around a file at the limit. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
/** How much of a refused body is read and thrown away, so the client gets the 413 instead of a reset. */
const DRAIN_LIMIT = { bytes: 50 * 1024 * 1024, ms: 2000 };

/** Reads and discards what's left of the request, up to the drain limit, then resolves. */
function drain(req: Request): Promise<void> {
  return new Promise((resolve) => {
    let seen = 0;
    const done = () => {
      clearTimeout(timer);
      req.removeListener('data', count);
      resolve();
    };
    const count = (chunk: Buffer) => {
      seen += chunk.length;
      if (seen > DRAIN_LIMIT.bytes) done();
    };
    const timer = setTimeout(done, DRAIN_LIMIT.ms);
    req.on('data', count).once('end', done).once('error', done).once('close', done);
    req.resume();
  });
}

/**
 * Makes a refused upload end with its error, not a dropped connection. Answering while the client (or
 * the Next.js proxy in front) is still sending makes the server close the socket, and the caller sees
 * a reset or a 500 instead of a 413. So: a declared size that is already too big is refused without
 * parsing, and any failure before the body has been read (multer's own 10 MB limit, for one) first
 * reads and discards the rest.
 */
@Injectable()
class UploadErrorsAfterBody implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const afterDrain = (error: unknown) => from(req.readableEnded ? Promise.resolve() : drain(req)).pipe(mergeMap(() => throwError(() => error)));
    if (Number(req.headers['content-length']) > MAX_DOCUMENT_BYTES + MULTIPART_OVERHEAD_BYTES) {
      return afterDrain(new PayloadTooLargeException('Files can be up to 10 MB'));
    }
    return next.handle().pipe(catchError(afterDrain));
  }
}

class DocumentListQueryDto extends createZodDto(documentListQuery) {}
class CreateDocumentTypeDto extends createZodDto(createDocumentTypeInput) {}
class UpdateDocumentTypeDto extends createZodDto(updateDocumentTypeInput) {}

@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @RequirePermission('document.view')
  @Get('documents')
  list(@CurrentAuth() auth: AuthContext, @Query() query: DocumentListQueryDto): Promise<ListResponse<DocumentItem>> {
    return this.documents.list(auth, query);
  }

  @RequirePermission('document.view')
  @Get('employees/:id/documents')
  async listForEmployee(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<DataResponse<DocumentItem[]>> {
    return { data: await this.documents.listForEmployee(auth, id) };
  }

  /** multipart/form-data: `file` plus `documentTypeId`, `title` and, for types that expire, `expiresAt`. */
  @RequirePermission('document.upload')
  @Post('employees/:id/documents')
  // Held in memory up to the 10 MB limit (413 beyond it), so the bytes can be checked before storing
  @UseInterceptors(UploadErrorsAfterBody, FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1, fields: 5, fieldSize: 1024 } }))
  async upload(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() body: UploadDocumentFields,
    @UploadedFile() file: UploadedDocumentFile | undefined,
  ): Promise<DataResponse<DocumentItem>> {
    return { data: await this.documents.upload(auth, id, body, file) };
  }

  @RequirePermission('document.view')
  @Get('documents/:id/url')
  async url(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<DataResponse<DocumentUrl>> {
    return { data: await this.documents.url(auth, id) };
  }

  @RequirePermission('document.delete')
  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentAuth() auth: AuthContext, @Param('id') id: string): Promise<void> {
    await this.documents.remove(auth, id);
  }
}

@Controller('document-types')
export class DocumentTypesController {
  constructor(private readonly types: DocumentTypesService) {}

  /** Everyone who can upload needs the list. */
  @Get()
  async list(@CurrentAuth() auth: AuthContext): Promise<DataResponse<DocumentTypeItem[]>> {
    return { data: await this.types.list(auth.permissions['document.manage_types'] !== undefined) };
  }

  @RequirePermission('document.manage_types')
  @Post()
  async create(@Body() body: CreateDocumentTypeDto): Promise<DataResponse<DocumentTypeItem>> {
    return { data: await this.types.create(body) };
  }

  @RequirePermission('document.manage_types')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateDocumentTypeDto): Promise<DataResponse<DocumentTypeItem>> {
    return { data: await this.types.update(id, body) };
  }

  @RequirePermission('document.manage_types')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.types.remove(id);
  }
}

/**
 * Downloads for the local storage driver: the token is the authority, like a presigned S3 URL, so
 * there is no session check. Anything wrong with the token is a plain 404. With the S3 driver the
 * links point at the bucket and this route always answers 404.
 */
@Controller('files')
export class FilesController {
  constructor(
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
    private readonly clock: Clock,
  ) {}

  @Public()
  @Get(':token')
  async download(@Param('token') token: string, @Res() res: Response): Promise<void> {
    const file = this.storage instanceof LocalDocumentStorage ? this.storage.open(token, this.clock.now()) : null;
    const size = file ? await stat(file.path).then((s) => s.size, () => null) : null;
    if (!file || size === null) throw new NotFoundException();

    res.set({
      'Content-Type': file.contentType,
      'Content-Length': String(size),
      'Content-Disposition': contentDisposition(file.filename),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      // Never run as a page on this origin, even if a browser ignored the attachment disposition
      'Content-Security-Policy': "default-src 'none'; sandbox",
    });
    createReadStream(file.path).pipe(res);
  }
}

@Module({
  controllers: [DocumentsController, DocumentTypesController, FilesController],
  providers: [
    DocumentsService,
    DocumentTypesService,
    DocumentExpiryReminders,
    { provide: DOCUMENT_STORAGE, inject: [APP_CONFIG], useFactory: (config: AppConfig) => createDocumentStorage(config) },
  ],
  exports: [DocumentsService, DOCUMENT_STORAGE],
})
export class DocumentsModule {}
