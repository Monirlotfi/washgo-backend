import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  /** Le laveur fait une offre sur un booking */
  @Post('washer/bookings/:id/offer')
  @Roles(UserRole.WASHER)
  makeOffer(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: CreateOfferDto,
  ) {
    return this.offersService.makeOffer(user.id, id, dto);
  }

  /** Le laveur liste ses offres en cours */
  @Get('washer/offers/mine')
  @Roles(UserRole.WASHER)
  myPendingOffers(@CurrentUser() user: { id: string }) {
    return this.offersService.listMyPendingOffers(user.id);
  }

  /** Le client liste les offres reçues sur son booking */
  @Get('bookings/:id/offers')
  @Roles(UserRole.CLIENT)
  listOffers(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.offersService.listOffersForBooking(user.id, id);
  }

  /** Le client choisit une offre */
  @Post('bookings/:id/offers/:offerId/choose')
  @Roles(UserRole.CLIENT)
  chooseOffer(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('offerId') offerId: string,
  ) {
    return this.offersService.chooseOffer(user.id, id, offerId);
  }
}