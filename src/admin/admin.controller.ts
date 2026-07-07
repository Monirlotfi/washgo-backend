import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsString, IsNotEmpty } from 'class-validator';

class RejectDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

class RetryDto {
  @IsString()
  @IsNotEmpty()
  message: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('washers/pending')
  getPendingWashers() {
    return this.adminService.getPendingWashers();
  }

  @Get('washers')
  getAllWashers(@Query('status') status?: string) {
    return this.adminService.getAllWashers(status);
  }

  @Get('washers/:id')
  getWasherDetail(@Param('id') id: string) {
    return this.adminService.getWasherDetail(id);
  }

  @Post('washers/:id/approve')
  approveWasher(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.adminService.approveWasher(id, user.id);
  }

  @Post('washers/:id/reject')
  rejectWasher(
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: any,
  ) {
    return this.adminService.rejectWasher(id, user.id, dto.reason);
  }

  @Post('washers/:id/retry')
  retryWasher(
    @Param('id') id: string,
    @Body() dto: RetryDto,
    @CurrentUser() user: any,
  ) {
    return this.adminService.retryWasher(id, user.id, dto.message);
  }

  @Get('carousel')
  getCarouselSlides() {
    return this.adminService.getAllCarouselSlides();
  }

  @Post('carousel')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  createCarouselSlide(
    @Body() dto: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const parsed: any = {};
    if (dto.title) parsed.title = dto.title;
    if (dto.subtitle) parsed.subtitle = dto.subtitle;
    if (dto.order !== undefined) parsed.order = parseInt(dto.order, 10);
    if (dto.active !== undefined) parsed.active = dto.active === 'true';
    return this.adminService.createCarouselSlide(parsed, file.buffer);
  }

  @Patch('carousel/:id')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  updateCarouselSlide(
    @Param('id') id: string,
    @Body() dto: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const parsed: any = {};
    if (dto.title !== undefined) parsed.title = dto.title;
    if (dto.subtitle !== undefined) parsed.subtitle = dto.subtitle;
    if (dto.order !== undefined) parsed.order = parseInt(dto.order, 10);
    if (dto.active !== undefined) parsed.active = dto.active === 'true';
    return this.adminService.updateCarouselSlide(id, parsed, file?.buffer);
  }

  @Delete('carousel/:id')
  deleteCarouselSlide(@Param('id') id: string) {
    return this.adminService.deleteCarouselSlide(id);
  }
}
