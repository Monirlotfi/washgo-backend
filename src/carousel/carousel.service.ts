import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCarouselDto } from './dto/create-carousel.dto';
import { UpdateCarouselDto } from './dto/update-carousel.dto';

@Injectable()
export class CarouselService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.carouselSlide.create({
      data: { ...dto, imageUrl },
    });
  }

  async updateSlide(id: string, dto: UpdateCarouselDto, imageUrl?: string) {
    const existing = await this.prisma.carouselSlide.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Slide introuvable');

    return this.prisma.carouselSlide.update({
      where: { id },
      data: imageUrl ? { ...dto, imageUrl } : dto,
    });
  }

  async deleteSlide(id: string) {
    const existing = await this.prisma.carouselSlide.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Slide introuvable');

    return this.prisma.carouselSlide.delete({ where: { id } });
  }
}
