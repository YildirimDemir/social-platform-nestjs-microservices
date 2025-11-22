import {
  Directive,
  Field,
  GraphQLISODateTime,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import { AbstractEntity } from '@app/common';
import { Column, Entity, Index } from 'typeorm';

@ObjectType()
@Directive('@shareable')
@Entity({ name: 'notifications' })
export class Notification extends AbstractEntity<Notification> {
  @Field(() => Int)
  @Index()
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Field()
  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Field(() => Int, { nullable: true })
  @Column({ name: 'actor_user_id', type: 'int', nullable: true })
  actorUserId?: number | null;

  @Field(() => String, { nullable: true })
  @Column({ name: 'actor_username', type: 'varchar', length: 255, nullable: true })
  actorUsername?: string | null;

  @Field(() => String, { nullable: true })
  @Column({ name: 'actor_profile_photo', type: 'varchar', length: 500, nullable: true })
  actorProfilePhoto?: string | null;

  @Field(() => Int, { nullable: true })
  @Column({ name: 'post_id', type: 'int', nullable: true })
  postId?: number | null;

  @Field(() => String, { nullable: true })
  @Column({ type: 'text', nullable: true })
  payload?: string | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date | null;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt?: Date;

  constructor(entity: Partial<Notification>) {
    super(entity);
  }
}
