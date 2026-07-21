import { NextResponse } from 'next/server';
import { storeGet, storeSet, storeAppendList } from '@/lib/store';
import { runScript } from '@/lib/runner';
import { shouldRun } from '@/lib/cron';
import { notifyScript } from '@/lib/notify';
const KEY = 'panel:scripts';
export const maxDuration = 60;

// 由 Vercel Cron（Hobby 计划每天触发一次）触发，遍历脚本，当天未跑过的则执行
export async function GET() {
  const list = await storeGet(KEY, []);
  const results = [];
  for (const s of list) {
    if (!shouldRun(s)) continue;
    let ok = false;
    let logs = '';
    const maxAtt = (s.retries || 0) + 1;
    for (let attempt = 0; attempt < maxAtt; attempt++) {
      // 单次脚本超时 15s（Hobby 函数时长有限，签到类 API 调用通常几秒完成）
      const r = await runScript(s, { timeout: 15 });
      logs = r.logs;
      ok = r.ok;
      if (ok) break;
    }
    const i = list.findIndex((x) => x.id === s.id);
    list[i] = { ...s, lastRun: Date.now(), lastStatus: ok ? 'success' : 'failed' };
    await storeSet(KEY, list);
    await storeAppendList('panel:logs:' + s.id, {
      time: Date.now(),
      status: ok ? 'success' : 'failed',
      logs,
      trigger: 'cron',
    });
    if (s.notify !== false) await notifyScript(s, ok, logs);
    results.push({ id: s.id, name: s.name, ok });
  }
  return NextResponse.json({ ran: results });
}
