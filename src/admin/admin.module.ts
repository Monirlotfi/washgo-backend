import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { CarouselService } from '../carousel/carousel.service';

@Module({
  imports: [NotificationsModule],
  controllers: [AdminController],
  providers: [AdminService, CarouselService],
})
export class AdminModule {}
