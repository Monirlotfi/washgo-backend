import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WasherService } from './washer.service';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { WasherCancelBookingDto } from './dto/washer-cancel-booking.dto';

@Controller('washer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.WASHER)
export class WasherController {
  constructor(private readonly washerService: WasherService) {}

  @Patch('location')
  updateLocation(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateLocationDto,
  ) {
    return this.washerService.updateLocation(user.id, dto);
  }

  @Post('availability')
  updateAvailability(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.washerService.updateAvailability(user.id, dto);
  }

  @Get('bookings/available')
  getAvailableBookings(@CurrentUser() user: { id: string }) {
    return this.washerService.getAvailableBookings(user.id);
  }

  @Get('bookings')
  getMyBookings(@CurrentUser() user: { id: string }) {
    return this.washerService.getMyBookings(user.id);
  }
  
  @Post('bookings/:id/cancel')
  cancelBooking(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: WasherCancelBookingDto,
  ) {
    return this.washerService.cancelByWasher(user.id, id, dto);
  }
  
  @Get('earnings/months')
  getEarningsMonths(@CurrentUser() user: { id: string }) {
    return this.washerService.getEarningsMonths(user.id);
  }

  @Get('earnings')
  getEarnings(
    @CurrentUser() user: { id: string },
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.washerService.getEarnings(user.id, year, month);
  }

  @Post('bookings/:id/accept')
  acceptBooking(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.washerService.acceptBooking(user.id, id);
  }

  @Post('bookings/:id/arrived')
  markArrived(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.washerService.markArrived(user.id, id);
  }

  @Post('bookings/:id/start')
  startWash(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.washerService.startWash(user.id, id);
  }

  @Post('bookings/:id/complete')
  completeWash(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.washerService.completeWash(user.id, id);
  }
}
