import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { OtpPurpose } from '@prisma/client';
import { MOROCCO_PHONE_MESSAGE, MOROCCO_PHONE_REGEX } from '../../common/phone.constants';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(MOROCCO_PHONE_REGEX, { message: MOROCCO_PHONE_MESSAGE })
  phone!: string;

  @IsOptional()
  @IsEnum(OtpPurpose)
  purpose?: OtpPurpose;
}
