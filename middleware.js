import { NextResponse } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // 登录接口和登录页本身放行
  if (pathname === '/api/login' || pathname === '/login') return NextResponse.next();

  // Cron 触发器：设了 CRON_SECRET 才校验 Bearer，否则放行（开发用）
  if (pathname === '/api/cron') {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = req.headers.get('authorization');
      if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME);
  if (!verifyToken(token?.value)) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*', '/'],
};
