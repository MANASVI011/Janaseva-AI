type Environment = Record<string, string | undefined>;

function databaseIdentity(connectionString: string) {
  const url = new URL(connectionString);
  return {
    host: url.hostname.toLowerCase().replace(/-pooler(?=\.|$)/, ''),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
  };
}

export function getBackendEnvFileOptions(nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv === 'production') {
    return { ignoreEnvFile: true as const };
  }

  return { envFilePath: '.env', ignoreEnvFile: false as const };
}

export function getRuntimeDatabaseUrl(
  environment: Environment = process.env,
): string {
  if (environment.DEMO_MODE === 'true') {
    const databaseUrl = environment.DATABASE_URL?.trim();
    const demoDatabaseUrl = environment.DEMO_DATABASE_URL?.trim();
    if (!databaseUrl || !demoDatabaseUrl) {
      throw new Error(
        'DEMO_MODE requires DATABASE_URL and a separate DEMO_DATABASE_URL.',
      );
    }

    try {
      const productionIdentity = databaseIdentity(databaseUrl);
      const demoIdentity = databaseIdentity(demoDatabaseUrl);
      if (
        productionIdentity.host === demoIdentity.host &&
        productionIdentity.database === demoIdentity.database
      ) {
        throw new Error(
          'DEMO_DATABASE_URL must target a database separate from DATABASE_URL.',
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('DEMO_DATABASE_URL')
      ) {
        throw error;
      }
      throw new Error('DEMO_MODE database URLs must be valid PostgreSQL URLs.');
    }

    return demoDatabaseUrl;
  }

  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set to initialize Prisma.');
  }

  return databaseUrl;
}

export function getPrismaCliDatabaseUrl(
  environment: Environment = process.env,
  isMigrationCommand = false,
): string {
  if (isMigrationCommand) {
    const unpooledUrl = environment.DATABASE_URL_UNPOOLED?.trim();
    if (unpooledUrl) {
      return unpooledUrl;
    }

    if (environment.NODE_ENV === 'production') {
      throw new Error(
        'DATABASE_URL_UNPOOLED must be set for production Prisma migrations.',
      );
    }
  }

  return getRuntimeDatabaseUrl(environment);
}
