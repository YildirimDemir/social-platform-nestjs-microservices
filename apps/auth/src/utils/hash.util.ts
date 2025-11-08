import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

export async function hashValue(value: string, cfg: ConfigService) {
  const rounds = parseInt(cfg.get<string>('BCRYPT_SALT_ROUNDS') || '10', 10);
  return bcrypt.hash(value, rounds);
}
