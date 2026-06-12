import {
  IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MinLength,
} from 'class-validator';
import { EquipmentType } from '@prisma/client';

export class RegisterWasherDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+212|0)[5-7][0-9]{8}$/, {
    message: 'Numéro marocain valide requis (ex: +212612345678)',
  })
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'Mot de passe minimum 8 caractères' })
  password!: string;

  @IsEnum(EquipmentType)
  equipmentType!: EquipmentType;

  @IsOptional()
  @IsString()
  licensePlate?: string;

  @IsString()
  @IsNotEmpty()
  firebaseIdToken!: string;
}