import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../models/user.entity';

const getCurrentUserByContext = (context: ExecutionContext): User => {
  const httpReq = context.switchToHttp().getRequest();
  if (httpReq?.user) return httpReq.user;

  const getArgByIndex = (context as any)?.getArgByIndex?.bind(context as any);
  const gqlCtx = typeof getArgByIndex === 'function' ? getArgByIndex(2) : undefined;
  if (gqlCtx?.req?.user) return gqlCtx.req.user;
  if (gqlCtx?.request?.user) return gqlCtx.request.user;

  return undefined as unknown as User;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => getCurrentUserByContext(context),
);
