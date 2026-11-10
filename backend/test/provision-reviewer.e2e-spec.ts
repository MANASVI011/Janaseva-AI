import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('reviewer provisioning command startup', () => {
  it('loads the generated Prisma client before requiring an interactive terminal', () => {
    const generatedClientPath = join(
      process.cwd(),
      'dist/generated/prisma/client.js',
    );
    const generatedEnumsPath = join(
      process.cwd(),
      'dist/generated/prisma/enums.js',
    );
    const result = spawnSync(
      process.execPath,
      ['scripts/provision-reviewer.mjs', '--local-demo'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          NODE_ENV: 'test',
          DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        },
        timeout: 10_000,
      },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      'Run this command in an interactive terminal.',
    );
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(
      'ERR_MODULE_NOT_FOUND',
    );
    expect(existsSync(generatedClientPath)).toBe(true);
    expect(existsSync(generatedEnumsPath)).toBe(true);
  });
});
