import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post(':id/rate')
  rate(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: CreateRatingDto,
  ) {
    return this.ratingsService.rateBooking(user.id, id, dto);
  }

  @Get(':id/rating')
  getRating(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.ratingsService.getByBooking(user.id, id);
  }
}