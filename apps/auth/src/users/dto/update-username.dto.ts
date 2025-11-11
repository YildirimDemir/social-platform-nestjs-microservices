import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

@InputType()
export class UpdateUsernameDto {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'Username may contain letters, numbers, underscores, hyphens, and dots.',
  })
  newUsername: string;
}
