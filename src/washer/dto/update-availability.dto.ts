import { IsEnum, IsOptional, IsLatitude, IsLongitude } from 'class-validator';
import { Type } from 'class-transformer';
import { WasherStatus } from '@prisma/client';

export class UpdateAvailabilityDto {
  @IsEnum([WasherStatus.AVAILABLE, WasherStatus.OFFLINE], {
    message: 'Le statut doit être AVAILABLE ou OFFLINE',
  })
  status!: 'AVAILABLE' | 'OFFLINE';

  @IsOptional()
  @IsLatitude({ message: 'Latitude invalide (doit être entre -90 et 90)' })
  @Type(() => Number)
  lat?: number;

  @IsOptional()
  @IsLongitude({ message: 'Longitude invalide (doit être entre -180 et 180)' })
  @Type(() => Number)
  lng?: number;
}
