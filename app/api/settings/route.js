import { NextResponse } from 'next/server';
import { storeGet, storeSet } from '@/lib/store';
const KEY = 'panel:settings';

export async function GET() {
  const s = await storeGet(KEY, {});
  return NextResponse.json(s);
}

export async function PUT(req) {
  const body = await req.json().catch(() => ({}));
  const cur = await storeGet(KEY, {});
  const merged = { ...cur, ...body };
  await storeSet(KEY, merged);
  return NextResponse.json(merged);
}
