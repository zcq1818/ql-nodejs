import { NextResponse } from 'next/server';
import { makeToken, COOKIE_NAME } from '@/lib/auth';

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  const expected = process.env.PANEL_PASSWORD || 'change_me_strong_password';
  if (password !== expected) {
    return NextResponse.json({ error: '密码错误' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, makeToken(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
