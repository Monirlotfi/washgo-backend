import {
  Controller, Get, Post, Param, Body, UseGuards, Query,
} from '@nestjs/common';
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

  // GET /api/v1/admin/washers/pending
  @Get('washers/pending')
  getPendingWashers() {
    return this.adminService.getPendingWashers();
  }

  // GET /api/v1/admin/washers?status=PENDING|APPROVED|REJECTED
  @Get('washers')
  getAllWashers(@Query('status') status?: string) {
    return this.adminService.getAllWashers(status);
  }

  // GET /api/v1/admin/washers/:id
  @Get('washers/:id')
  getWasherDetail(@Param('id') id: string) {
    return this.adminService.getWasherDetail(id);
  }

  // POST /api/v1/admin/washers/:id/approve
  @Post('washers/:id/approve')
  approveWasher(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.adminService.approveWasher(id, user.id);
  }

  // POST /api/v1/admin/washers/:id/reject
  @Post('washers/:id/reject')
  rejectWasher(
    @Param('id') id: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: any,
  ) {
    return this.adminService.rejectWasher(id, user.id, dto.reason);
  }

  // POST /api/v1/admin/washers/:id/retry
  @Post('washers/:id/retry')
  retryWasher(
    @Param('id') id: string,
    @Body() dto: RetryDto,
    @CurrentUser() user: any,
  ) {
    return this.adminService.retryWasher(id, user.id, dto.message);
  }
}