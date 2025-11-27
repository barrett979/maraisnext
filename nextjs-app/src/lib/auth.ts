import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { validateUserCredentials, type User } from './users';

const SESSION_COOKIE = 'session';
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days in seconds

function getSecret() {
  const secret = process.env.AUTH_SECRET || 'dev-secret-change-in-production-32ch';
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  user: string;
  userId: number;
  role: string;
  exp: number;
}

export async function createSession(user: User): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION;

  const token = await new SignJWT({
    user: user.username,
    userId: user.id,
    role: user.role
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expiresAt)
    .setIssuedAt()
    .sign(getSecret());

  return token;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return verifySession(token);
}

export function validateCredentials(username: string, password: string): User | null {
  return validateUserCredentials(username, password);
}

export { SESSION_COOKIE, SESSION_DURATION };
