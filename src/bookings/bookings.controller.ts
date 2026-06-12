import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(UserRole.CLIENT)
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingsService.create(user.id, dto);
  }

  @Get()
  @Roles(UserRole.CLIENT)
  findMine(@CurrentUser() user: { id: string }) {
    return this.bookingsService.findByClient(user.id);
  }

  // Routes spécifiques (préfixes statiques) AVANT les routes paramétrées
  @Get('history')
  @Roles(UserRole.CLIENT)
  history(@CurrentUser() user: { id: string }) {
    return this.bookingsService.getHistoryForClient(user.id);
  }

  @Get('pricing/:vehicleId')
  @Roles(UserRole.CLIENT)
  getPricing(
    @CurrentUser() user: { id: string },
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.bookingsService.getPricesForVehicle(user.id, vehicleId);
  }

  // Routes avec :id en DERNIER
  @Get(':id')
  @Roles(UserRole.CLIENT)
  findOne(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.bookingsService.findOneForClient(user.id, id);
  }

  @Post(':id/confirm-completion')
  @Roles(UserRole.CLIENT)
  confirmCompletion(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.bookingsService.confirmCompletion(user.id, id);
  }

  @Delete(':id')
  @Roles(UserRole.CLIENT)
  cancel(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancelByClient(user.id, id, dto);
  }
}