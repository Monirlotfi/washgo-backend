import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { CarouselModule } from '../carousel/carousel.module';

@Module({
  imports: [NotificationsModule, CarouselModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
