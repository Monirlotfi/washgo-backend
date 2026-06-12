import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { VehicleCategory, VehicleSize } from '@prisma/client';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  brand!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  model!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{1,5}[-\s]?[A-Za-z]{1,3}[-\s]?[0-9]{1,3}$/, {
    message:
      'Format de plaque marocaine invalide (ex: 12345-A-1 ou 1234 A 12)',
  })
  plate!: string;

  /** Ancien champ — on garde pour rétrocompat. Auto-rempli si category fourni. */
  @IsOptional()
  @IsEnum(VehicleSize)
  size?: VehicleSize;

  @IsEnum(VehicleCategory, {
    message: 'category doit être CITY_CAR, LARGE_VEHICLE ou MOTORCYCLE',
  })
  category!: VehicleCategory;
}