import { NextResponse } from 'next/server';
import { storeGet, storeSet } from '@/lib/store';
const KEY = 'panel:scripts';

export async function GET(req, { params }) {
  const list = await storeGet(KEY, []);
  const s = list.find((x) => x.id === params.id);
  if (!s) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(s);
}

export async function PUT(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const list = await storeGet(KEY, []);
  const i = list.findIndex((x) => x.id === params.id);
  if (i < 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
  list[i] = { ...list[i], ...body, id: params.id };
  try {
    await storeSet(KEY, list);
  } catch (e) {
    return NextResponse.json({ error: e.message || '存储写入失败' }, { status: 500 });
  }
  return NextResponse.json(list[i]);
}

export async function DELETE(req, { params }) {
  let list = await storeGet(KEY, []);
  list = list.filter((x) => x.id !== params.id);
  await storeSet(KEY, list);
  return NextResponse.json({ ok: true });
}
