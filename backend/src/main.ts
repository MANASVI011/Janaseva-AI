import { NestFactory } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AppModule } from './app.module.js';

async function createApplication() {
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
