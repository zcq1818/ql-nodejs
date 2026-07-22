import { NextResponse } from 'next/server';
import { storeGet, storeSet, storeAppendList } from '@/lib/store';
import { runScript } from '@/lib/runner';
import { shouldRun } from '@/lib/cron';
import { notifyScript } from '@/lib/notify';
import { juejinSignin } from '@/lib/juejinSignin';
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

  // 浏览器版掘金签到：复用每日唯一的 cron 触发（无需额外 cron 路径，兼容 Hobby），
  // 仅在设置了 JUEJIN_COOKIE 环境变量时才执行。
  if (process.env.JUEJIN_COOKIE) {
    try {
      const r = await juejinSignin(process.env.JUEJIN_COOKIE, { timeout: 50 });
      await storeAppendList('panel:logs:juejin', {
        time: Date.now(),
        status: r.ok ? 'success' : 'failed',
        logs: r.logs.join('\n'),
        trigger: 'cron',
      });
      if (process.env.JUEJIN_NOTIFY !== 'false') {
        await notifyScript({ name: '掘金签到(浏览器)' }, r.ok, r.logs.join('\n'));
      }
      results.push({ id: 'juejin-browser', name: '掘金签到(浏览器)', ok: r.ok });
    } catch (e) {
      results.push({ id: 'juejin-browser', name: '掘金签到(浏览器)', ok: false });
    }
  }

  return NextResponse.json({ ran: results });
}
