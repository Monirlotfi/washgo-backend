import {
  IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength,
} from 'class-validator';
import { MOROCCO_PHONE_MESSAGE, MOROCCO_PHONE_REGEX } from '../../common/phone.constants';

export class RegisterClientDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(MOROCCO_PHONE_REGEX, { message: MOROCCO_PHONE_MESSAGE })
  phone!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email invalide' })
  email?: string;

  @IsString()
  @MinLength(8, { message: 'Mot de passe minimum 8 caractères' })
  password!: string;
}