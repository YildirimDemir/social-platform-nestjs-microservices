import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Post, User, CurrentUser, JwtAuthGuard } from '@app/common';
import { PostsService } from './posts.service';
import { CreatePostInput } from './dto/create-post.input';
import { ReplyToPostInput } from './dto/reply-to-post.input';

@Resolver(() => Post)
export class PostsResolver {
  constructor(private readonly postsService: PostsService) {}

  @UseGuards(JwtAuthGuard)
  @Mutation(() => Post)
  createPost(
    @Args('input') input: CreatePostInput,
    @CurrentUser() user: User,
  ): Promise<Post> {
    return this.postsService.createPost(user.id, input);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => Post)
  replyToPost(
    @Args('input') input: ReplyToPostInput,
    @CurrentUser() user: User,
  ): Promise<Post> {
    return this.postsService.replyToPost(user.id, input);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => Boolean)
  deletePost(
    @Args('postId', { type: () => Int }) postId: number,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.postsService.deletePost(postId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => Post)
  toggleLikePost(
    @Args('postId', { type: () => Int }) postId: number,
    @CurrentUser() user: User,
  ): Promise<Post> {
    return this.postsService.toggleLike(postId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => Post)
  toggleSavePost(
    @Args('postId', { type: () => Int }) postId: number,
    @CurrentUser() user: User,
  ): Promise<Post> {
    return this.postsService.toggleSave(postId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => [Post])
  posts(
    @CurrentUser() user: User,
    @Args('includeReplies', {
      type: () => Boolean,
      nullable: true,
      defaultValue: false,
    })
    includeReplies = false,
  ): Promise<Post[]> {
    return this.postsService.findAll(user.id, includeReplies);
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => [Post])
  postsByUser(
    @Args('userId', { type: () => Int }) userId: number,
    @CurrentUser() currentUser: User,
    @Args('includeReplies', {
      type: () => Boolean,
      nullable: true,
      defaultValue: false,
    })
    includeReplies = false,
  ): Promise<Post[]> {
    return this.postsService.findByAuthor(userId, currentUser.id, includeReplies);
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => [Post])
  likedPosts(@CurrentUser() user: User): Promise<Post[]> {
    return this.postsService.findLikedByUser(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => [Post])
  savedPosts(@CurrentUser() user: User): Promise<Post[]> {
    return this.postsService.findSavedByUser(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => [Post])
  repliesForPost(
    @Args('postId', { type: () => Int }) postId: number,
    @CurrentUser() user: User,
  ): Promise<Post[]> {
    return this.postsService.findRepliesForPost(postId, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => [Post])
  searchPosts(
    @Args('search', { type: () => String }) search: string,
    @CurrentUser() user: User,
    @Args('includeReplies', {
      type: () => Boolean,
      nullable: true,
      defaultValue: true,
    })
    includeReplies = true,
  ): Promise<Post[]> {
    return this.postsService.searchPosts(search, user.id, includeReplies);
  }
}
