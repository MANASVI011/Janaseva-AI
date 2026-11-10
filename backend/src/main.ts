import { existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { delimiter, join } from 'node:path';
import type { Request, Response } from 'express';

function configureVercelModuleResolution() {
  if (process.env.VERCEL !== '1') return;

  const nodePaths =
    process.env.NODE_PATH?.split(delimiter).filter(Boolean) ?? [];
  const backendNodeModules = [
    join(__dirname, 'backend', 'node_modules'),
    join(__dirname, '..', 'node_modules'),
    join(process.cwd(), 'backend', 'node_modules'),
    join(process.cwd(), 'node_modules'),
  ].filter(
    (path) =>
      existsSync(join(path, '@nestjs', 'core', 'package.json')) &&
      !nodePaths.includes(path),
  );
  if (backendNodeModules.length === 0) return;

  process.env.NODE_PATH = [...nodePaths, ...backendNodeModules].join(delimiter);
  const initializeModulePaths = Reflect.get(Module, '_initPaths');
  if (typeof initializeModulePaths !== 'function') {
    throw new Error('Node module path initialization is unavailable');
  }
  initializeModulePaths.call(Module);
}

async function createApplication() {
  configureVercelModuleResolution();
  const { NestFactory } = createRequire(__filename)(
    '@nestjs/core',
  ) as typeof import('@nestjs/core');
  const { AppModule } = await import('./app.module.js');
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
  return app;
}

const application = createApplication();
const expressServer =
  process.env.VERCEL === '1'
    ? application.then(async (app) => {
        await app.init();
        return app.getHttpAdapter().getInstance();
      })
    : undefined;

export default async function handler(
  request: Request,
  response: Response,
): Promise<void> {
  if (!expressServer) {
    throw new Error('The serverless handler requires the Vercel runtime');
  }

  const server = await expressServer;
  server(request, response);
}

if (!expressServer) {
  void application
    .then((app) => app.listen(process.env.PORT ?? 3002))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
