import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, CacheEntry<any>>();
  private readonly defaultTtlMs: number;
  private redis: Redis | null = null;

  constructor(private readonly config: ConfigService) {
    this.defaultTtlMs = this.config.get<number>('CACHE_TTL_MS') ?? 30000;

    const redisHost = this.config.get<string>('REDIS_HOST');
    if (redisHost) {
      const redisPort = this.config.get<number>('REDIS_PORT') ?? 6379;
      const redisPassword = this.config.get<string>('REDIS_PASSWORD') || undefined;
      const useTls = this.config.get<string>('REDIS_TLS') === 'true';
      try {
        this.redis = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword,
          tls: useTls ? {} : undefined,
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        });
        this.redis.connect().catch(() => {
          this.logger.warn('Redis connection failed, falling back to in-memory cache');
          this.redis = null;
        });
      } catch {
        this.logger.warn('Redis unavailable, using in-memory cache');
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    }
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  async set<T>(key: string, data: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.defaultTtlMs;
    if (this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(data), 'PX', ttl);
        return;
      } catch {
        /* fallback to in-memory */
      }
    }
    this.store.set(key, { data, expiresAt: Date.now() + ttl });
  }

  async del(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch {
        /* ignore */
      }
    }
    this.store.delete(key);
  }

  async delPattern(pattern: string): Promise<void> {
    if (this.redis) {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length) await this.redis.del(...keys);
      } catch {
        /* ignore */
      }
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern.replace('*', ''))) this.store.delete(key);
    }
  }
}
