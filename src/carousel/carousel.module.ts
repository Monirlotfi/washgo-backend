import { Module } from '@nestjs/common';
import { CarouselController } from './carousel.controller';
import { CarouselService } from './carousel.service';
import { CarouselGateway } from './carousel.gateway';

@Module({
  controllers: [CarouselController],
  providers: [CarouselService, CarouselGateway],
  exports: [CarouselService, CarouselGateway],
})
export class CarouselModule {}
