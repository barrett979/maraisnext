import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SESSION_COOKIE = 'session';
const SESSION_DURATION = 60 * 60 * 24 * 7; // 7 days in seconds

// Use a fallback secret for development, but require AUTH_SECRET in production
function getSecret() {
  const secret = process.env.AUTH_SECRET || 'dev-secret-change-in-production-32ch';
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  user: string;
  exp: number;
}

export async function createSession(username: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION;

  const token = await new SignJWT({ user: username })
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

export function validateCredentials(username: string, password: string): boolean {
  const validUser = process.env.JS_USER;
  const validPass = process.env.JS_PASS;

  if (!validUser || !validPass) {
    console.error('JS_USER or JS_PASS not configured in environment');
    return false;
  }

  return username === validUser && password === validPass;
}

export { SESSION_COOKIE, SESSION_DURATION };
