import { IsEmail, IsNotEmpty } from 'class-validator';

export class SendVerificationCodeDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
