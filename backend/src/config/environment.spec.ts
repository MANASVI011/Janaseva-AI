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

  it('uses an isolated database for production demo mode', () => {
    const demoUrl = 'postgresql://demo.example/janaseva_demo';
    expect(
      getRuntimeDatabaseUrl({
        DATABASE_URL: 'postgresql://production.example/neondb',
        DEMO_DATABASE_URL: demoUrl,
        DEMO_MODE: 'true',
        NODE_ENV: 'production',
      }),
    ).toBe(demoUrl);
  });

  it('rejects demo mode without a separate demo database URL', () => {
    expect(() =>
      getRuntimeDatabaseUrl({
        DATABASE_URL: 'postgresql://production.example/neondb',
        DEMO_MODE: 'true',
        NODE_ENV: 'production',
      }),
    ).toThrow(
      'DEMO_MODE requires DATABASE_URL and a separate DEMO_DATABASE_URL',
    );
  });

  it('rejects demo mode pointed at the production database, including pooled URLs', () => {
    expect(() =>
      getRuntimeDatabaseUrl({
        DATABASE_URL:
          'postgresql://owner@ep-main-pooler.region.neon.tech/neondb',
        DEMO_DATABASE_URL: 'postgresql://demo@ep-main.region.neon.tech/neondb',
        DEMO_MODE: 'true',
        NODE_ENV: 'production',
      }),
    ).toThrow(
      'DEMO_DATABASE_URL must target a database separate from DATABASE_URL',
    );
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
