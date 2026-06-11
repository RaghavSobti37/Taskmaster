import { randomBytes } from 'crypto';

export function newMongoId(): string {
  return randomBytes(12).toString('hex');
}
