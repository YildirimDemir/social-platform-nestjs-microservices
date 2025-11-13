import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

@InputType()
export class UpdateProfilePhotoDto {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  photoUrl: string;
}
