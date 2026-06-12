import { IsString, IsNotEmpty } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  pushToken!: string;
}