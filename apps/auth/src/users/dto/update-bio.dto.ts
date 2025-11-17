import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, MaxLength } from 'class-validator';

@InputType()
export class UpdateBioDto {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(280)
  bio?: string;
}
