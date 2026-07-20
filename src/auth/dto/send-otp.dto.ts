import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { MOROCCO_PHONE_MESSAGE, MOROCCO_PHONE_REGEX } from '../../common/phone.constants';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(MOROCCO_PHONE_REGEX, { message: MOROCCO_PHONE_MESSAGE })
  phone!: string;
}
