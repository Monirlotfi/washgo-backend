import {
  Equals, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EquipmentType } from '@prisma/client';
import { MOROCCO_PHONE_MESSAGE, MOROCCO_PHONE_REGEX } from '../../common/phone.constants';

export class RegisterWasherDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(MOROCCO_PHONE_REGEX, { message: MOROCCO_PHONE_MESSAGE })
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'Mot de passe minimum 8 caractères' })
  password!: string;

  @IsEnum(EquipmentType)
  equipmentType!: EquipmentType;

  @IsOptional()
  @IsString()
  licensePlate?: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @Equals(true, { message: "Vous devez accepter la notice d'information relative au traitement de vos données personnelles" })
  dataConsentAccepted!: boolean;
}