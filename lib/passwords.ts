import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [scheme, salt, stored] = passwordHash.split(':');
  if (scheme !== 'scrypt' || !salt || !stored) return false;

  const derived = scryptSync(password, salt, KEY_LENGTH);
  const storedBuffer = Buffer.from(stored, 'hex');
  if (storedBuffer.length !== derived.length) return false;
  return timingSafeEqual(storedBuffer, derived);
}
