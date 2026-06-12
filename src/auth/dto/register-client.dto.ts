import {
  IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength,
} from 'class-validator';

export class RegisterClientDto {
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

  @IsOptional()
  @IsEmail({}, { message: 'Email invalide' })
  email?: string;

  @IsString()
  @MinLength(8, { message: 'Mot de passe minimum 8 caractères' })
  password!: string;

  @IsString()
  @IsNotEmpty()
  firebaseIdToken!: string;
}