import { NextResponse } from 'next/server';
import { storeGet, storeSet } from '@/lib/store';
import crypto from 'crypto';

const KEY = 'panel:scripts';

export async function GET() {
  const list = await storeGet(KEY, []);
  return NextResponse.json(list);
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (!body.name || !body.code) {
    return NextResponse.json({ error: 'name 和 code 必填' }, { status: 400 });
  }
  const list = await storeGet(KEY, []);
  const script = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    name: body.name,
    code: body.code,
    cron: body.cron || '',
    vars: body.vars || {},
    enabled: body.enabled !== false,
    retries: body.retries || 0,
    notify: body.notify !== false,
    lastRun: null,
    lastStatus: null,
    createdAt: Date.now(),
  };
  list.push(script);
  await storeSet(KEY, list);
  return NextResponse.json(script);
}
