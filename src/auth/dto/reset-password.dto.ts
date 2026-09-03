import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import { MOROCCO_PHONE_MESSAGE, MOROCCO_PHONE_REGEX } from '../../common/phone.constants';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @Matches(MOROCCO_PHONE_REGEX, { message: MOROCCO_PHONE_MESSAGE })
  phone!: string;

  @IsString()
  @MinLength(8, { message: 'Mot de passe minimum 8 caractères' })
  newPassword!: string;
}
