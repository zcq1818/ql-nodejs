import { NextResponse } from 'next/server';
import { storeGet, storeSet, storeAppendList } from '@/lib/store';
import { runScript } from '@/lib/runner';
import { notifyScript } from '@/lib/notify';
const KEY = 'panel:scripts';
export const maxDuration = 60;

export async function POST(req, { params }) {
  const list = await storeGet(KEY, []);
  const s = list.find((x) => x.id === params.id);
  if (!s) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const { ok, logs } = await runScript(s, { timeout: 55 });
  const i = list.findIndex((x) => x.id === params.id);
  list[i] = { ...s, lastRun: Date.now(), lastStatus: ok ? 'success' : 'failed' };
  await storeSet(KEY, list);
  await storeAppendList('panel:logs:' + params.id, {
    time: Date.now(),
    status: ok ? 'success' : 'failed',
    logs,
  });
  if (s.notify !== false) await notifyScript(s, ok, logs);
  return NextResponse.json({ ok, logs });
}
