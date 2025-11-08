import { UnauthorizedException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AUTH_SERVICE } from '@app/common';
import { lastValueFrom } from 'rxjs';
import { app } from './app';

const extractToken = (req: any): string | undefined => {
  const headerToken =
    req.headers?.authorization || req.headers?.authentication || req.headers?.Authorization;
  if (headerToken && typeof headerToken === 'string') {
    return headerToken.startsWith('Bearer ')
      ? headerToken.slice(7)
      : headerToken.trim();
  }

  if (req.cookies?.Authentication) {
    return req.cookies.Authentication;
  }

  return undefined;
};

export const authContext = async ({ req }) => {
  const token = extractToken(req);

  if (!token) {
    return { user: null, authToken: null };
  }

  try {
    if (!app) {
      throw new UnauthorizedException('Gateway context not initialized');
    }
    const authClient = app.get<ClientProxy>(AUTH_SERVICE);
    const user = await lastValueFrom(
      authClient.send('authenticate', {
        Authentication: token,
      }),
    );

    return { user, authToken: token };
  } catch (err) {
    throw new UnauthorizedException('Authentication failed');
  }
};
