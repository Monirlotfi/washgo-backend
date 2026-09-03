import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Controller('debug')
export class DebugController {
  constructor(private readonly config: ConfigService) {}

  @Get('redis-check')
  async redisCheck(@Headers('x-debug-key') key?: string) {
    if (!key || key !== this.config.get<string>('JWT_SECRET')) {
      throw new UnauthorizedException();
    }

    const host = this.config.get<string>('REDIS_HOST');
    const port = this.config.get<number>('REDIS_PORT') ?? 6379;
    const useTls = this.config.get<string>('REDIS_TLS') === 'true';
    const hasPassword = !!this.config.get<string>('REDIS_PASSWORD');

    const events: string[] = [];

    return new Promise((resolve) => {
      const redis = new Redis({
        host,
        port,
        password: this.config.get<string>('REDIS_PASSWORD') || undefined,
        tls: useTls ? {} : undefined,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 8000,
      });

      const config = {
        host, port, tls: useTls, hasPassword,
        mode: 'host/port fields + tls:{} object (TLS socket, not a rediss:// URL string)',
      };

      const finish = (extra: Record<string, unknown>) => {
        redis.disconnect();
        resolve({ config, events, ...extra });
      };

      const timeout = setTimeout(() => {
        finish({ success: false, error: 'TIMEOUT after 10s — connection never reached ready or error state' });
      }, 10000);

      redis.on('connect', () => events.push('connect'));
      redis.on('ready', () => events.push('ready'));
      redis.on('error', (err) => events.push(`error: ${err.message}`));

      redis.connect()
        .then(() => redis.ping())
        .then((pong) => {
          clearTimeout(timeout);
          finish({ success: pong === 'PONG', pong });
        })
        .catch((err) => {
          clearTimeout(timeout);
          finish({ success: false, error: err.message });
        });
    });
  }
}
