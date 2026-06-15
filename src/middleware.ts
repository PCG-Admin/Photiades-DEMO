import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, isValidSession } from '@/lib/auth';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = isValidSession(req.cookies.get(SESSION_COOKIE)?.value);

  // The login page is the only public route.
  if (pathname === '/login') {
    if (authed) return NextResponse.redirect(new URL('/dashboard', req.url));
    return NextResponse.next();
  }

  // Everything else requires a session.
  if (!authed) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next internals and static asset files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)'],
};
