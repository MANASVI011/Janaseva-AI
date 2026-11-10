import { Module } from 'node:module';
import { delimiter, join } from 'node:path';

function configureVercelModuleResolution() {
  if (process.env.VERCEL !== '1') return;

  const backendNodeModules = join(__dirname, 'backend', 'node_modules');
  const nodePaths = process.env.NODE_PATH?.split(delimiter) ?? [];

  if (nodePaths.includes(backendNodeModules)) return;

  process.env.NODE_PATH = [...nodePaths, backendNodeModules].join(delimiter);
  const initializeModulePaths = Reflect.get(Module, '_initPaths');

  if (typeof initializeModulePaths !== 'function') {
    throw new Error('Node module path initialization is unavailable');
  }

  initializeModulePaths.call(Module);
}

async function bootstrap() {
  configureVercelModuleResolution();

  const [{ NestFactory }, { AppModule }] = await Promise.all([
    import('@nestjs/core'),
    import('./app.module.js'),
  ]);

  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Janaseva-Demo-Auth',
      'X-Janaseva-Demo-Field-Officer',
      'X-Janaseva-Demo-Review-Officer',
    ],
  });
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  await app.listen(process.env.PORT ?? 3002);
}
bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
