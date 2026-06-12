import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { WasherCancellationReason } from '@prisma/client';

export class WasherCancelBookingDto {
  @IsEnum(WasherCancellationReason, {
    message:
      'Motif invalide (MECHANICAL_ISSUE, PERSONAL_EMERGENCY, HEALTH_ISSUE, OTHER)',
  })
  reason!: WasherCancellationReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customReason?: string;
}