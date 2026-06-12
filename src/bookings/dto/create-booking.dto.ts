import {
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WashType } from '@prisma/client';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  vehicleId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  addressLabel!: string;

  @IsLatitude({ message: 'La latitude doit être entre -90 et 90' })
  @Type(() => Number)
  lat!: number;

  @IsLongitude({ message: 'La longitude doit être entre -180 et 180' })
  @Type(() => Number)
  lng!: number;

  @IsOptional()
  @IsEnum(WashType, {
    message: 'washType doit être BASIC, PREMIUM ou VIP',
  })
  washType?: WashType;

  @IsOptional()
  @IsDateString({}, { message: 'scheduledAt doit être une date ISO valide' })
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}