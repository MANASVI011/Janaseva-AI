import { BadRequestException } from '@nestjs/common';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DocumentStorageService } from './document-storage.service.js';

describe('DocumentStorageService', () => {
  let directory: string;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  async function createStorage() {
    directory = await mkdtemp(join(tmpdir(), 'janaseva-documents-'));
    return new DocumentStorageService({
      get: () => directory,
    } as never);
  }

  it('accepts supported document signatures and rejects extensions that disagree', async () => {
    const storage = await createStorage();
    expect(
      storage.validateFile({
        originalname: 'sample.pdf',
        mimetype: 'application/pdf',
        size: 5,
        buffer: Buffer.from('%PDF-'),
      }),
    ).toBe('application/pdf');
    expect(
      storage.validateFile({
        originalname: 'sample.jpg',
        mimetype: 'image/jpeg',
        size: 3,
        buffer: Buffer.from([0xff, 0xd8, 0xff]),
      }),
    ).toBe('image/jpeg');
    expect(
      storage.validateFile({
        originalname: 'sample.png',
        mimetype: 'image/png',
        size: 8,
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      }),
    ).toBe('image/png');
    expect(() =>
      storage.validateFile({
        originalname: 'sample.png',
        mimetype: 'application/pdf',
        size: 5,
        buffer: Buffer.from('%PDF-'),
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      storage.validateFile({
        originalname: 'sample.pdf',
        mimetype: 'application/pdf',
        size: 5,
        buffer: Buffer.from('not a pdf'),
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects unsupported content and files over the size limit', async () => {
    const storage = await createStorage();
    expect(() =>
      storage.validateFile({
        originalname: 'sample.gif',
        mimetype: 'image/gif',
        size: 6,
        buffer: Buffer.from('GIF89a'),
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      storage.validateFile({
        originalname: 'large.pdf',
        mimetype: 'application/pdf',
        size: 10 * 1024 * 1024 + 1,
        buffer: Buffer.from('%PDF-'),
      }),
    ).toThrow(BadRequestException);
  });

  it('stores bytes under a generated private name and returns the original bytes', async () => {
    const storage = await createStorage();
    const bytes = Buffer.from('%PDF-synthetic sample');
    const storageKey = await storage.save(bytes, 'application/pdf');
    expect(storageKey).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(await storage.read(storageKey)).toEqual(bytes);
    expect((await stat(join(directory, storageKey))).mode & 0o777).toBe(0o600);
    await expect(storage.read('../secret.pdf')).rejects.toThrow();
    await storage.remove(storageKey);
  });
});
