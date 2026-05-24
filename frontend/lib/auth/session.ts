import 'server-only';
import { cookies } from 'next/headers';
import { decodeJwt } from 'jose';
import { COOKIE_NAME } from './cookies';

export async function getSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value ?? null;
}

export async function getSessionExpiry(): Promise<Date | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    const { exp } = decodeJwt(token);
    if (typeof exp !== 'number') return null;
    return new Date(exp * 1000);
  } catch {
    return null;
  }
}

export async function isSessionValid(): Promise<boolean> {
  const expiry = await getSessionExpiry();
  return expiry !== null && expiry.getTime() > Date.now();
}
