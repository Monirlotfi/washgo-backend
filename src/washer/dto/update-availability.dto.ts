import { IsEnum } from 'class-validator';
import { WasherStatus } from '@prisma/client';

export class UpdateAvailabilityDto {
  @IsEnum([WasherStatus.AVAILABLE, WasherStatus.OFFLINE], {
    message: 'Le statut doit être AVAILABLE ou OFFLINE',
  })
  status!: 'AVAILABLE' | 'OFFLINE';
}
