import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AppConfig } from '../../config/env';

export const DOCUMENT_STORAGE = Symbol('DOCUMENT_STORAGE');

export interface SignedUrlOptions {
  /** The name the browser saves the file as. */
  filename: string;
  contentType: string;
  expiresInSeconds: number;
  now: Date;
}

/**
 * A private place for document files (decision D4). Callers pass opaque keys; nothing outside this
 * interface knows whether files are on disk or in a bucket, and keys never leave the server.
 */
export interface DocumentStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** The file's bytes, or null when there is none. For small files the API serves itself (card photos). */
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  /** A short-lived link that downloads the file as an attachment. Never stored. */
  signedUrl(key: string, options: SignedUrlOptions): Promise<string>;
}

/** Keys are made by the server (`employees/{id}/{uuid}`); anything else is a bug, not user input. */
const KEY = /^[a-z0-9-]+(\/[a-z0-9-]+)+$/;

function assertKey(key: string): void {
  if (!KEY.test(key)) throw new Error('Invalid storage key');
}

/**
 * `attachment` with an ASCII fallback name and the exact name in RFC 5987 form, so a title in Bangla
 * still downloads with the right name and no header injection is possible.
 */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  // encodeURIComponent throws on half a surrogate pair
  const wellFormed = filename.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '\ufffd');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(wellFormed)}`;
}

// ─── Local disk (development and tests) ─────────────────────────────────────────────────────────

interface LocalToken {
  /** storage key */
  k: string;
  /** expiry, epoch ms */
  e: number;
  n: string;
  t: string;
}

/**
 * Files on local disk, downloaded through `GET /files/:token`. The token is the link's whole
 * authority, like an S3 presigned URL: AES-256-GCM over the key, expiry, name and type, so it can't be
 * forged or changed, and the storage key inside can't be read. The encryption key lives only in this
 * process, so links die with a restart. The env schema refuses this driver in production.
 */
export class LocalDocumentStorage implements DocumentStorage {
  private readonly root: string;
  private readonly secret = randomBytes(32);

  constructor(dir: string) {
    this.root = path.resolve(dir);
  }

  private pathOf(key: string): string {
    assertKey(key);
    return path.join(this.root, ...key.split('/'));
  }

  async put(key: string, body: Buffer): Promise<void> {
    const target = this.pathOf(key);
    await mkdir(path.dirname(target), { recursive: true });
    // Write then rename, so a crash never leaves half a file under the real name
    const temporary = `${target}.${randomBytes(6).toString('hex')}.part`;
    await writeFile(temporary, body, { flag: 'wx' });
    await rename(temporary, target);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathOf(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  signedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    assertKey(key);
    const payload: LocalToken = { k: key, e: options.now.getTime() + options.expiresInSeconds * 1000, n: options.filename, t: options.contentType };
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.secret, iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    const token = Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
    return Promise.resolve(`/api/v1/files/${token}`);
  }

  /** The file behind a token, or null when the token is forged, changed or expired. */
  open(token: string, now: Date): { path: string; filename: string; contentType: string } | null {
    try {
      const raw = Buffer.from(token, 'base64url');
      if (raw.length < 29) return null;
      const decipher = createDecipheriv('aes-256-gcm', this.secret, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      const payload = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')) as LocalToken;
      if (payload.e < now.getTime()) return null;
      return { path: this.pathOf(payload.k), filename: payload.n, contentType: payload.t };
    } catch {
      return null;
    }
  }
}

// ─── S3-compatible bucket (production) ──────────────────────────────────────────────────────────

export class S3DocumentStorage implements DocumentStorage {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    options: { region: string; endpoint?: string; forcePathStyle: boolean; accessKeyId?: string; secretAccessKey?: string },
  ) {
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle,
      credentials: options.accessKeyId && options.secretAccessKey ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey } : undefined,
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    assertKey(key);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ContentLength: body.length }));
  }

  async get(key: string): Promise<Buffer | null> {
    assertKey(key);
    try {
      const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return object.Body ? Buffer.from(await object.Body.transformToByteArray()) : null;
    } catch (error) {
      if ((error as { name?: string }).name === 'NoSuchKey') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    assertKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  signedUrl(key: string, options: SignedUrlOptions): Promise<string> {
    assertKey(key);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: contentDisposition(options.filename),
      ResponseContentType: options.contentType,
      ResponseCacheControl: 'private, no-store',
    });
    return getSignedUrl(this.client, command, { expiresIn: options.expiresInSeconds });
  }
}

export function createDocumentStorage(config: AppConfig): DocumentStorage {
  if (config.STORAGE_DRIVER === 's3') {
    return new S3DocumentStorage(config.S3_BUCKET!, {
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
    });
  }
  return new LocalDocumentStorage(config.STORAGE_LOCAL_DIR);
}
