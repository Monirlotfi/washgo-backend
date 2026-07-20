import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { MOROCCO_PHONE_MESSAGE, MOROCCO_PHONE_REGEX } from '../../common/phone.constants';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(MOROCCO_PHONE_REGEX, { message: MOROCCO_PHONE_MESSAGE })
  phone!: string;

  @IsString()
  @Length(6, 6, { message: 'Code à 6 chiffres requis' })
  code!: string;
}
