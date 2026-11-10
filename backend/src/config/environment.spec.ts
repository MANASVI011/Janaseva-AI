import { describe, expect, it } from 'vitest';
import {
  getBackendEnvFileOptions,
  getPrismaCliDatabaseUrl,
  getRuntimeDatabaseUrl,
} from './environment.js';

describe('backend environment selection', () => {
  it('loads the backend .env file for local development', () => {
    expect(getBackendEnvFileOptions('development')).toEqual({
      envFilePath: '.env',
      ignoreEnvFile: false,
    });
  });

  it('does not load dotenv files in production', () => {
    expect(getBackendEnvFileOptions('production')).toEqual({
      ignoreEnvFile: true,
    });
  });

  it('uses the injected runtime DATABASE_URL', () => {
    const injectedUrl = 'postgresql://injected.example/neondb';
    expect(
      getRuntimeDatabaseUrl({
        DATABASE_URL: injectedUrl,
        NODE_ENV: 'production',
      }),
    ).toBe(injectedUrl);
  });

  it('prefers the unpooled URL for Prisma migration commands', () => {
    const unpooledUrl = 'postgresql://direct.example/neondb';
    expect(
      getPrismaCliDatabaseUrl(
        {
          DATABASE_URL: 'postgresql://pooled.example/neondb',
          DATABASE_URL_UNPOOLED: unpooledUrl,
          NODE_ENV: 'production',
        },
        true,
      ),
    ).toBe(unpooledUrl);
  });

  it('rejects production migrations without an unpooled URL', () => {
    expect(() =>
      getPrismaCliDatabaseUrl(
        {
          DATABASE_URL: 'postgresql://pooled.example/neondb',
          NODE_ENV: 'production',
        },
        true,
      ),
    ).toThrow('DATABASE_URL_UNPOOLED must be set');
  });

  it('allows local Prisma migrations to use the local DATABASE_URL', () => {
    const localUrl = 'postgresql://localhost:5432/janaseva_ai';
    expect(
      getPrismaCliDatabaseUrl(
        { DATABASE_URL: localUrl, NODE_ENV: 'development' },
        true,
      ),
    ).toBe(localUrl);
  });
});
