import { Directive, Field, HideField, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  RelationId,
} from 'typeorm';
import { AbstractEntity } from '../database';
import { User } from './user.entity';

@ObjectType()
@Directive('@shareable')
@Entity()
export class Post extends AbstractEntity<Post> {
  @Field()
  @Column({ type: 'text' })
  content: string;

  @Field(() => User)
  @ManyToOne(() => User, (user) => user.posts, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Field(() => Int)
  @Column({ default: 0 })
  likesCount: number;

  @Field(() => Int)
  @Column({ default: 0 })
  commentsCount: number;

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  imageUrl?: string;

  @Field({ defaultValue: false })
  @Column({ default: false })
  isPinned: boolean;

  @Field({ defaultValue: false })
  @Column({ default: false })
  isReply: boolean;

  @Field(() => Int, { nullable: true })
  @RelationId((post: Post) => post.replyToPost)
  replyToPostId?: number;

  @Field(() => Post, { nullable: true })
  @ManyToOne(() => Post, (post) => post.replies, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'reply_to_post_id' })
  replyToPost?: Post | null;

  @HideField()
  @OneToMany(() => Post, (post) => post.replyToPost)
  replies?: Post[];

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 50, nullable: true })
  location?: string;

  @Field({ defaultValue: false })
  @Column({ default: false })
  isEdited: boolean;

  @Field(() => Boolean, { nullable: true })
  isLiked?: boolean;

  @Field(() => Boolean, { nullable: true })
  isSaved?: boolean;
}
