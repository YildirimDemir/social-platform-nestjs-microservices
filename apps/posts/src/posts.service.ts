import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  Post,
  User,
  PostsRepository,
  UsersRepository,
  NOTIFICATIONS_SERVICE,
  NOTIFICATION_EVENT_POST_LIKED,
  NOTIFICATION_EVENT_POST_REPLIED,
} from '@app/common';
import { Repository } from 'typeorm';
import { CreatePostInput } from './dto/create-post.input';
import { ReplyToPostInput } from './dto/reply-to-post.input';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

interface UserPostMeta {
  liked: Set<number>;
  saved: Set<number>;
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    private readonly postsRepository: PostsRepository,
    private readonly usersRepository: UsersRepository,
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsClient: ClientProxy,
  ) {}

  private get postRepo(): Repository<Post> {
    return this.postsRepository.repository;
  }

  private get userRepo(): Repository<User> {
    return this.usersRepository.repository;
  }

  async createPost(authorId: number, input: CreatePostInput): Promise<Post> {
    return this.createPostInternal(authorId, input);
  }

  async replyToPost(authorId: number, input: ReplyToPostInput): Promise<Post> {
    if (!input.postId) {
      throw new BadRequestException('A parent post id must be provided.');
    }

    return this.createPostInternal(authorId, input, input.postId);
  }

  async deletePost(postId: number, authorId: number): Promise<boolean> {
    const post = await this.postRepo.findOne({
      where: { id: postId },
      relations: {
        author: true,
        replyToPost: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    if (post.author.id !== authorId) {
      throw new ForbiddenException('You can only delete your own posts.');
    }

    const parentId = post.replyToPost?.id;

    await this.postRepo.delete(postId);

    if (parentId) {
      const parent = await this.postRepo.findOne({
        where: { id: parentId },
        select: ['id', 'commentsCount'],
      });

      if (parent) {
        parent.commentsCount = Math.max(0, parent.commentsCount - 1);
        await this.postRepo.save(parent);
      }
    }

    return true;
  }

  async toggleLike(postId: number, userId: number): Promise<Post> {
    const post = await this.postRepo.findOne({
      where: { id: postId },
      relations: { author: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { likedPosts: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const hasLiked = (user.likedPosts ?? []).some((liked) => liked.id === postId);

    if (hasLiked) {
      await this.userRepo
        .createQueryBuilder()
        .relation(User, 'likedPosts')
        .of(userId)
        .remove(postId);
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      await this.userRepo
        .createQueryBuilder()
        .relation(User, 'likedPosts')
        .of(userId)
        .add(postId);
      post.likesCount += 1;
    }

    await this.postRepo.save(post);

    if (!hasLiked && post.author?.id !== userId) {
      await this.notifyPostLiked(post, user);
    }

    return this.loadPostWithMeta(postId, userId);
  }

  async toggleSave(postId: number, userId: number): Promise<Post> {
    const post = await this.postRepo.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: { savedPosts: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const hasSaved = (user.savedPosts ?? []).some((saved) => saved.id === postId);

    if (hasSaved) {
      await this.userRepo
        .createQueryBuilder()
        .relation(User, 'savedPosts')
        .of(userId)
        .remove(postId);
    } else {
      await this.userRepo
        .createQueryBuilder()
        .relation(User, 'savedPosts')
        .of(userId)
        .add(postId);
    }

    return this.loadPostWithMeta(postId, userId);
  }

  async findAll(
    currentUserId: number,
    includeReplies = false,
  ): Promise<Post[]> {
    const [posts, meta] = await Promise.all([
      this.postRepo.find({
        where: includeReplies ? {} : { isReply: false },
        order: { id: 'DESC' },
        relations: {
          author: true,
          replyToPost: { author: true },
        },
      }),
      this.loadUserMeta(currentUserId),
    ]);

    return this.attachMetaToMany(posts, meta);
  }

  async findByAuthor(
    authorId: number,
    currentUserId: number,
    includeReplies = false,
  ): Promise<Post[]> {
    const author = await this.userRepo.findOne({
      where: { id: authorId },
    });

    if (!author) {
      throw new NotFoundException('Author not found.');
    }

    const [posts, meta] = await Promise.all([
      this.postRepo.find({
        where: includeReplies
          ? { author: { id: authorId } }
          : { author: { id: authorId }, isReply: false },
        order: { id: 'DESC' },
        relations: {
          author: true,
          replyToPost: { author: true },
        },
      }),
      this.loadUserMeta(currentUserId),
    ]);

    return this.attachMetaToMany(posts, meta);
  }

  async searchPosts(
    search: string,
    currentUserId: number,
    includeReplies = true,
  ): Promise<Post[]> {
    const term = search?.trim().toLowerCase();
    if (!term) {
      return [];
    }

    const qb = this.postRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.replyToPost', 'replyToPost')
      .leftJoinAndSelect('replyToPost.author', 'replyAuthor')
      .orderBy('post.id', 'DESC')
      .where(
        '(LOWER(post.content) LIKE :search OR LOWER(author.username) LIKE :search)',
        { search: `%${term}%` },
      );

    if (!includeReplies) {
      qb.andWhere('post.isReply = :isReply', { isReply: false });
    }

    const [posts, meta] = await Promise.all([
      qb.getMany(),
      this.loadUserMeta(currentUserId),
    ]);

    return this.attachMetaToMany(posts, meta);
  }

  async findLikedByUser(userId: number): Promise<Post[]> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: {
        likedPosts: {
          author: true,
          replyToPost: { author: true },
        },
        savedPosts: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const meta = this.createMetaFromUser(user);

    const likedPosts = [...(user.likedPosts ?? [])].sort(
      (a, b) => b.id - a.id,
    );

    return this.attachMetaToMany(likedPosts, meta);
  }

  async findSavedByUser(userId: number): Promise<Post[]> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: {
        savedPosts: {
          author: true,
          replyToPost: { author: true },
        },
        likedPosts: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const meta = this.createMetaFromUser(user);

    const savedPosts = [...(user.savedPosts ?? [])].sort(
      (a, b) => b.id - a.id,
    );

    return this.attachMetaToMany(savedPosts, meta);
  }

  async findRepliesForPost(
    postId: number,
    currentUserId: number,
  ): Promise<Post[]> {
    const parent = await this.postRepo.findOne({
      where: { id: postId },
    });

    if (!parent) {
      throw new NotFoundException('Post not found.');
    }

    const [posts, meta] = await Promise.all([
      this.postRepo.find({
        where: { replyToPost: { id: postId } },
        order: { id: 'ASC' },
        relations: {
          author: true,
          replyToPost: { author: true },
        },
      }),
      this.loadUserMeta(currentUserId),
    ]);

    return this.attachMetaToMany(posts, meta);
  }

  private async createPostInternal(
    authorId: number,
    input: CreatePostInput,
    replyToPostId?: number,
  ): Promise<Post> {
    const author = await this.userRepo.findOne({
      where: { id: authorId },
    });

    if (!author) {
      throw new NotFoundException('Author not found.');
    }

    let parent: Post | null = null;
    if (replyToPostId) {
      parent = await this.postRepo.findOne({
        where: { id: replyToPostId },
        relations: { author: true },
      });

      if (!parent) {
        throw new NotFoundException('Parent post not found.');
      }
    }

    const content = input.content.trim();

    if (!content.length) {
      throw new BadRequestException('Post content cannot be empty.');
    }

    const post = this.postRepo.create({
      content,
      imageUrl: input.imageUrl,
      location: input.location,
      isPinned: input.isPinned ?? false,
      isEdited: false,
      isReply: Boolean(parent),
      author,
      replyToPost: parent,
    });

    const saved = await this.postRepo.save(post);

    if (parent) {
      await this.postRepo.increment(
        { id: parent.id },
        'commentsCount',
        1,
      );

      if (parent.author?.id !== authorId) {
        await this.notifyPostReplied(parent, author, content, saved.id);
      }
    }

    return this.loadPostWithMeta(saved.id, authorId);
  }

  private async loadPostWithMeta(
    postId: number,
    currentUserId: number,
  ): Promise<Post> {
    const [post, meta] = await Promise.all([
      this.postRepo.findOne({
        where: { id: postId },
        relations: {
          author: true,
          replyToPost: { author: true },
        },
      }),
      this.loadUserMeta(currentUserId),
    ]);

    if (!post) {
      throw new NotFoundException('Post not found.');
    }

    return this.attachMeta(post, meta);
  }

  private async loadUserMeta(userId?: number): Promise<UserPostMeta> {
    if (!userId) {
      return this.createEmptyMeta();
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: {
        likedPosts: true,
        savedPosts: true,
      },
    });

    return this.createMetaFromUser(user ?? undefined);
  }

  private createMetaFromUser(user?: User): UserPostMeta {
    return {
      liked: new Set(user?.likedPosts?.map((post) => post.id) ?? []),
      saved: new Set(user?.savedPosts?.map((post) => post.id) ?? []),
    };
  }

  private createEmptyMeta(): UserPostMeta {
    return { liked: new Set(), saved: new Set() };
  }

  private attachMeta(post: Post, meta: UserPostMeta): Post {
    post.isLiked = meta.liked.has(post.id);
    post.isSaved = meta.saved.has(post.id);

    if (post.replyToPost) {
      post.replyToPost.isLiked = meta.liked.has(post.replyToPost.id);
      post.replyToPost.isSaved = meta.saved.has(post.replyToPost.id);
    }

    return post;
  }

  private attachMetaToMany(posts: Post[], meta: UserPostMeta): Post[] {
    return posts.map((post) => this.attachMeta(post, meta));
  }

  private async notifyPostLiked(post: Post, liker: User) {
    const recipientEmail = post.author?.email;
    if (!recipientEmail) {
      return;
    }

    try {
      await lastValueFrom(
        this.notificationsClient.emit(NOTIFICATION_EVENT_POST_LIKED, {
          email: recipientEmail,
          recipientUserId: post.author?.id,
          likerUsername: liker.username ?? liker.email ?? 'Someone',
          likerId: liker.id,
          likerProfilePhoto: liker.profilePhoto ?? null,
          postId: post.id,
          postContent: post.content,
        }),
      );
    } catch (error) {
      this.logger.warn(`Failed to emit post liked notification: ${this.describeError(error)}`);
    }
  }

  private async notifyPostReplied(
    parentPost: Post,
    replier: User,
    replyContent: string,
    replyId: number,
  ) {
    const recipientEmail = parentPost.author?.email;
    if (!recipientEmail) {
      return;
    }

    try {
      await lastValueFrom(
        this.notificationsClient.emit(NOTIFICATION_EVENT_POST_REPLIED, {
          email: recipientEmail,
          replyUsername: replier.username ?? replier.email ?? 'Someone',
          replyUserId: replier.id,
          replyProfilePhoto: replier.profilePhoto ?? null,
          recipientUserId: parentPost.author?.id,
          replyContent,
          postId: parentPost.id,
          replyId,
        }),
      );
    } catch (error) {
      this.logger.warn(`Failed to emit post replied notification: ${this.describeError(error)}`);
    }
  }

  private describeError(error: unknown): string {
    if (!error) return 'unknown error';
    if (error instanceof Error) return error.message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
