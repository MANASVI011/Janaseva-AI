import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_DOCUMENT_TYPES = {
  'application/pdf': { extension: 'pdf', signature: 'pdf' },
  'image/jpeg': { extension: 'jpg', signature: 'jpeg' },
  'image/png': { extension: 'png', signature: 'png' },
} as const;

export type AcceptedMimeType = keyof typeof ALLOWED_DOCUMENT_TYPES;

@Injectable()
export class DocumentStorageService {
  private readonly logger = new Logger(DocumentStorageService.name);
  private readonly root: string;

  constructor(config: ConfigService) {
    const configured =
      config.get<string>('DOCUMENT_STORAGE_PATH') ??
      resolve(process.cwd(), '.private-documents');
    this.root = isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured);
  }

  validateFile(file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }): AcceptedMimeType {
    if (!file.size || file.size > MAX_DOCUMENT_BYTES) {
      throw new BadRequestException(
        'Document files must be between 1 byte and 10 MB.',
      );
    }
    const descriptor =
      ALLOWED_DOCUMENT_TYPES[file.mimetype as AcceptedMimeType];
    if (
      !descriptor ||
      !this.hasValidSignature(file.buffer, descriptor.signature)
    ) {
      throw new BadRequestException(
        'Only valid PDF, JPG, JPEG, or PNG documents are accepted.',
      );
    }

    const extension = file.originalname.split('.').pop()?.toLowerCase();
    const allowedExtensions: Record<AcceptedMimeType, string[]> = {
      'application/pdf': ['pdf'],
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
    };
    if (
      !extension ||
      !allowedExtensions[file.mimetype as AcceptedMimeType].includes(extension)
    ) {
      throw new BadRequestException(
        'The filename extension does not match the document content.',
      );
    }
    return file.mimetype as AcceptedMimeType;
  }

  async save(data: Buffer, mimeType: AcceptedMimeType): Promise<string> {
    const extension = ALLOWED_DOCUMENT_TYPES[mimeType].extension;
    const storageKey = `${randomUUID()}.${extension}`;
    const path = resolve(this.root, storageKey);
    if (dirname(path) !== this.root) {
      throw new InternalServerErrorException(
        'Private storage path is invalid.',
      );
    }
    try {
      await mkdir(this.root, { recursive: true, mode: 0o700 });
      await chmod(this.root, 0o700);
      await writeFile(path, data, { flag: 'wx', mode: 0o600 });
      return storageKey;
    } catch (error) {
      this.logger.error('Unable to write private document data.');
      throw new InternalServerErrorException(
        'The document could not be stored securely.',
        { cause: error },
      );
    }
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(this.pathFor(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await rm(this.pathFor(storageKey), { force: true });
    } catch (error) {
      this.logger.error('Unable to clean up an uncommitted document file.');
      throw new InternalServerErrorException(
        'The document storage cleanup failed.',
        { cause: error },
      );
    }
  }

  private pathFor(storageKey: string): string {
    if (!/^[0-9a-f-]{36}\.(pdf|jpg|png)$/.test(storageKey)) {
      throw new InternalServerErrorException(
        'The document storage key is invalid.',
      );
    }
    const path = resolve(this.root, storageKey);
    if (dirname(path) !== this.root) {
      throw new InternalServerErrorException(
        'The document storage key is invalid.',
      );
    }
    return path;
  }

  private hasValidSignature(
    buffer: Buffer,
    signature: 'pdf' | 'jpeg' | 'png',
  ): boolean {
    if (signature === 'pdf')
      return buffer.subarray(0, 5).toString() === '%PDF-';
    if (signature === 'jpeg') {
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    }
    return (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
}
