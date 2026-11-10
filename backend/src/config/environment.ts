type Environment = Record<string, string | undefined>;

export function getBackendEnvFileOptions(nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv === 'production') {
    return { ignoreEnvFile: true as const };
  }

  return { envFilePath: '.env', ignoreEnvFile: false as const };
}

export function getRuntimeDatabaseUrl(
  environment: Environment = process.env,
): string {
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
