import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Fully allows incoming connections from mobile platforms
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // 2. Strict type parsing and DTO filtering
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 3000;
  
  // 3. FIXED: Listen on '0.0.0.0' to broadcast the API over your local network interfaces.
  // This allows real physical test devices on your Wi-Fi to hit your server.
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 WashGo API running on http://localhost:${port}/api/v1`);
  console.log(`🌐 Accessible on local network at http://192.168.1.11:${port}/api/v1`);
}
bootstrap();