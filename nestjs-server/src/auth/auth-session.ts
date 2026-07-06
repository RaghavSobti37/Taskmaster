import jwt from 'jsonwebtoken';

export interface SessionTokenPayload {
  id: string;
  activeTenantId?: string;
  loginAt?: number;
  jti?: string;
  purpose?: string;
  iat?: number;
  exp?: number;
}

/** Sliding inactivity window — renewed on activity (default 7 days). */
export function inactivityExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || '7d';
}

/** Hard cap from original login — forces re-auth after this (default 30 days). */
export function absoluteMaxMs(): number {
  const days = Number(process.env.JWT_ABSOLUTE_MAX_DAYS) || 30;
  return days * 24 * 60 * 60 * 1000;
}

const nowSec = (): number => Math.floor(Date.now() / 1000);

export function resolveLoginAt(decoded: SessionTokenPayload): number {
  if (decoded.loginAt != null && Number.isFinite(decoded.loginAt)) {
    return decoded.loginAt;
  }
  if (decoded.iat != null && Number.isFinite(decoded.iat)) {
    return decoded.iat;
  }
  return nowSec();
}

export function isAbsoluteSessionExpired(decoded: SessionTokenPayload): boolean {
  const loginAt = resolveLoginAt(decoded);
  return Date.now() - loginAt * 1000 > absoluteMaxMs();
}

export function verifySessionToken(
  token: string,
  secret: string,
): SessionTokenPayload {
  return jwt.verify(token, secret) as SessionTokenPayload;
}
