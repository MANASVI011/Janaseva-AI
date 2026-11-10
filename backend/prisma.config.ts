import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { getPrismaCliDatabaseUrl } from './src/config/environment.js';

if (process.env.NODE_ENV !== 'production') {
  loadDotenv({ path: resolve(process.cwd(), '.env'), override: false });
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: getPrismaCliDatabaseUrl(process.env, process.argv.includes('migrate')),
  },
});
