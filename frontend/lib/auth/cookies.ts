export const COOKIE_NAME = process.env.JWT_COOKIE_NAME ?? 'ep_session';

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
    secure: process.env.NODE_ENV === 'production',
  };
}
