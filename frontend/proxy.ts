import { NextResponse, type NextRequest } from 'next/server';
import { decodeJwt } from 'jose';
import { COOKIE_NAME } from '@/lib/auth/cookies';

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;

  let valid = false;
  if (token) {
    try {
      const { exp } = decodeJwt(token);
      if (typeof exp === 'number' && exp * 1000 > Date.now()) {
        valid = true;
      }
    } catch {
      valid = false;
    }
  }

  if (valid) return NextResponse.next();

  const url = new URL('/login', req.url);
  url.searchParams.set('reason', 'expired');
  url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
