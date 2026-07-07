import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCarouselDto } from './dto/create-carousel.dto';
import { UpdateCarouselDto } from './dto/update-carousel.dto';
import { CarouselGateway } from './carousel.gateway';

@Injectable()
export class CarouselService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carouselGateway: CarouselGateway,
  ) {}

  async getActiveSlides() {
    return this.prisma.carouselSlide.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
    });
  }

  async getAllSlides() {
    return this.prisma.carouselSlide.findMany({
      orderBy: { order: 'asc' },
    });
  }

  async createSlide(dto: CreateCarouselDto, imageUrl: string) {
    const slide = await this.prisma.carouselSlide.create({
      data: { ...dto, imageUrl },
    });
    this.carouselGateway.emitCarouselUpdate();
    return slide;
  }

  async updateSlide(id: string, dto: UpdateCarouselDto, imageUrl?: string) {
    const existing = await this.prisma.carouselSlide.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Slide introuvable');

    const slide = await this.prisma.carouselSlide.update({
      where: { id },
      data: imageUrl ? { ...dto, imageUrl } : dto,
    });
    this.carouselGateway.emitCarouselUpdate();
    return slide;
  }

  async deleteSlide(id: string) {
    const existing = await this.prisma.carouselSlide.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Slide introuvable');

    const slide = await this.prisma.carouselSlide.delete({ where: { id } });
    this.carouselGateway.emitCarouselUpdate();
    return slide;
  }
}
