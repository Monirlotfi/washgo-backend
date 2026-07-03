import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import compression from 'compression';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {});

  app.enableCors({ origin: true, credentials: true });

  app.use(compression());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  // Keep Neon DB alive — prevents cold starts on serverless Postgres
  const prisma = app.get(PrismaService);
  setInterval(async () => {
    try {
      await prisma.$executeRaw`SELECT 1`;
    } catch (err: any) {
      console.warn('[KeepAlive] DB ping failed:', err.message);
    }
  }, 30_000);

  console.log(`🚀 WashGo API running on http://localhost:${port}/api/v1`);
}
bootstrap();