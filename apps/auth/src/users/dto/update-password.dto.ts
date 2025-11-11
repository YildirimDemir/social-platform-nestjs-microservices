import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

@InputType()
export class UpdatePasswordDto {
  @Field()
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @Field()
  @IsString()
  @MinLength(8)
  newPassword: string;

  @Field()
  @IsString()
  @MinLength(8)
  confirmPassword: string;
}
