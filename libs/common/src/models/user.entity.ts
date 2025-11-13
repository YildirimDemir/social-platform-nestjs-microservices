import { Directive, Field, HideField, ObjectType } from '@nestjs/graphql';
import { AbstractEntity } from '../database';
import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
} from 'typeorm';
import { Role } from './role.entity';
import { Post } from './post.entity';

@ObjectType()
@Directive('@shareable')
@Entity()
export class User extends AbstractEntity<User> {
  @Field()
  @Column()
  username: string;

  @Field()
  @Column()
  email: string;

  @HideField()
  @Column()
  password: string;

  @Field(() => [Role], { nullable: true })
  @ManyToMany(() => Role, { cascade: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles?: Role[];

  @HideField()
  @OneToMany(() => Post, (post) => post.author)
  posts?: Post[];

  @HideField()
  @ManyToMany(() => Post)
  @JoinTable({
    name: 'user_liked_posts',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'post_id', referencedColumnName: 'id' },
  })
  likedPosts?: Post[];

  @HideField()
  @ManyToMany(() => Post)
  @JoinTable({
    name: 'user_saved_posts',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'post_id', referencedColumnName: 'id' },
  })
  savedPosts?: Post[];

  @Field(() => [User], { nullable: true })
  @ManyToMany(() => User, (user) => user.followers)
  @JoinTable({
    name: 'user_followers',
    joinColumn: { name: 'follower_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'following_id', referencedColumnName: 'id' },
  })
  following?: User[];

  @Field(() => [User], { nullable: true })
  @ManyToMany(() => User, (user) => user.following)
  followers?: User[];

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  profilePhoto?: string;
}
