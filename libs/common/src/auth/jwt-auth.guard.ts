import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Reflector } from '@nestjs/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { AUTH_SERVICE } from '../constants/services';
import { User } from '../models';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    @Inject(AUTH_SERVICE) private readonly authClient: ClientProxy,
    private readonly reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = this.getRequestFromContext(context);
    const authHeader = request?.headers?.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : undefined;

    const jwt =
      request?.cookies?.Authentication ||
      request?.headers?.authentication ||
      bearerToken;

    if (!jwt) {
      return false;
    }

    const roles = this.reflector.get<string[]>('roles', context.getHandler());

    return this.authClient
      .send<User>('authenticate', {
        Authentication: jwt,
      })
      .pipe(
        tap((res) => {
          if (roles) {
            for (const role of roles) {
              if (!res.roles?.map((role) => role.name).includes(role)) {
                this.logger.error('The user does not have valid roles.');
                throw new UnauthorizedException();
              }
            }
          }
          const httpRequest = context.switchToHttp().getRequest();
          if (httpRequest) {
            httpRequest.user = res;
          }

          const gqlContext = this.getGraphqlContext(context);
          if (gqlContext?.req) {
            gqlContext.req.user = res;
          }
          if (gqlContext?.request) {
            gqlContext.request.user = res;
          }
        }),
        map(() => true),
        catchError((err) => {
          this.logger.error(err);
          return of(false);
        }),
      );
  }

  private getGraphqlContext(context: ExecutionContext) {
    const getArgByIndex = (context as any)?.getArgByIndex?.bind(context as any);
    if (typeof getArgByIndex === 'function') {
      return getArgByIndex(2);
    }
    return undefined;
  }

  private getRequestFromContext(context: ExecutionContext) {
    const httpRequest = context.switchToHttp().getRequest();
    if (httpRequest && Object.keys(httpRequest).length) {
      return httpRequest;
    }

    const gqlContext = this.getGraphqlContext(context);
    if (gqlContext?.req) {
      return gqlContext.req;
    }
    if (gqlContext?.request) {
      return gqlContext.request;
    }

    return undefined;
  }
}
