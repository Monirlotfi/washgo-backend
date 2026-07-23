import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const MAX_CONNECT_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1000;
const SLOW_QUERY_THRESHOLD_MS = 500;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    (this as any).$on('query', (e: any) => {
      if (e.duration >= SLOW_QUERY_THRESHOLD_MS) {
        this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
      }
    });

    for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Database connected');
        return;
      } catch (err) {
        if (attempt === MAX_CONNECT_ATTEMPTS) throw err;

        const delayMs = INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1);
        this.logger.warn(
          `Database connection attempt ${attempt}/${MAX_CONNECT_ATTEMPTS} failed, retrying in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
