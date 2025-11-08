import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt } from 'class-validator';
import { CreatePostInput } from './create-post.input';

@InputType()
export class ReplyToPostInput extends CreatePostInput {
  @Field(() => Int)
  @IsInt()
  postId: number;
}
