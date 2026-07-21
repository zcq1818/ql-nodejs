import { NextResponse } from 'next/server';
import { storeGet, storeSet } from '@/lib/store';
import { normalizeFiles, resolveEntry } from '@/lib/scriptModel';
import crypto from 'crypto';

const KEY = 'panel:scripts';

export async function GET() {
  const list = await storeGet(KEY, []);
  return NextResponse.json(list);
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (!body.name) {
    return NextResponse.json({ error: 'name 必填' }, { status: 400 });
  }
  const files = normalizeFiles(body);
  if (files.length === 0 || !files[0].content) {
    return NextResponse.json({ error: '至少需要一个文件且有代码' }, { status: 400 });
  }
  const language = (body.language || 'js').toLowerCase();
  const entry = resolveEntry(body.entry, files, language);
  const list = await storeGet(KEY, []);
  const script = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    name: body.name,
    language,
    files,
    entry,
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
  try {
    await storeSet(KEY, list);
  } catch (e) {
    return NextResponse.json({ error: e.message || '存储写入失败' }, { status: 500 });
  }
  return NextResponse.json(script);
}
