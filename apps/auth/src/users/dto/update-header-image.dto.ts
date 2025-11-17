import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, MaxLength } from 'class-validator';

@InputType()
export class UpdateHeaderImageDto {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  headerImage?: string;
}
