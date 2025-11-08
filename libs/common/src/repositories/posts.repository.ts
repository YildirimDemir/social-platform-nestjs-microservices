import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AbstractRepository } from '../database';
import { Post } from '../models';

@Injectable()
export class PostsRepository extends AbstractRepository<Post> {
  protected readonly logger = new Logger(PostsRepository.name);

  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    entityManager: EntityManager,
  ) {
    super(postsRepository, entityManager);
  }

  get repository() {
    return this.postsRepository;
  }
}
