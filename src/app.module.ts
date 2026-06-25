import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { BookingsModule } from './bookings/bookings.module';
import { WasherModule } from './washer/washer.module';
import { UserModule } from './user/user.module';
import { RatingsModule } from './ratings/ratings.module';
import { OffersModule } from './offers/offers.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FirebaseModule } from './firebase/firebase.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const useTls = config.get<string>('REDIS_TLS') === 'true';
        const redisHost = config.get<string>('REDIS_HOST') || process.env.REDIS_HOST || 'localhost';
        console.log(`[Redis] Connecting to ${redisHost}:${config.get<number>('REDIS_PORT', 6379)} (TLS: ${useTls})`);
        return {
          connection: {
            host: redisHost,
            port: config.get<number>('REDIS_PORT', 6379),
            password: config.get<string>('REDIS_PASSWORD') || undefined,
            tls: useTls ? {} : undefined,
            maxRetriesPerRequest: null,
            connectTimeout: 5000,
            lazyConnect: false,
            retryStrategy: (times: number) => {
              if (times > 3) return null;
              return Math.min(times * 200, 2000);
            },
          },
        };
      },
      inject: [ConfigService],
    }),

    PrismaModule,
    AuthModule,
    VehiclesModule,
    BookingsModule,
    WasherModule,
    UserModule,
    RatingsModule,
    OffersModule,
    NotificationsModule,
    FirebaseModule,
    CloudinaryModule,
    AdminModule,
  ],
})
export class AppModule {}