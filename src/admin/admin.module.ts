import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { CarouselModule } from '../carousel/carousel.module';

@Module({
  imports: [NotificationsModule, CloudinaryModule, CarouselModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}