import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/signin', '/signup'];
const COOKIE_NAME = 'morph_token';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const hasToken = req.cookies.has(COOKIE_NAME);

  if (!hasToken && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/signin';
    return NextResponse.redirect(url);
  }

  if (hasToken && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Exclude ALL _next/* internal routes (static, image, HMR, data, etc.) and static assets
  matcher: ['/((?!_next/|favicon.ico|morph.png).*)'],
};
