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
import { InfobipModule } from './infobip/infobip.module';
import { AdminModule } from './admin/admin.module';
import { CarouselModule } from './carousel/carousel.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          return {
            connection: {
              url: redisUrl,
              maxRetriesPerRequest: null,
            },
          };
        }
        const useTls = config.get<string>('REDIS_TLS') === 'true';
        return {
          connection: {
            host: config.get<string>('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
            password: config.get<string>('REDIS_PASSWORD') || undefined,
            tls: useTls ? {} : undefined,
            maxRetriesPerRequest: null,
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
    InfobipModule,
    AdminModule,
    CarouselModule,
  ],
})
export class AppModule {}