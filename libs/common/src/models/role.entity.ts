import { Directive, Field, ObjectType } from '@nestjs/graphql';
import { AbstractEntity } from '../database';
import { Column, Entity } from 'typeorm';

@ObjectType()
@Directive('@shareable')
@Entity()
export class Role extends AbstractEntity<Role> {
  @Field()
  @Column()
  name: string;
}
