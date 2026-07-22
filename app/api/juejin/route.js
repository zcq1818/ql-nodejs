// 掘金浏览器签到 —— 手动触发入口
// GET /api/juejin  -> 读取环境变量 JUEJIN_COOKIE，启动无头浏览器执行签到
// 用于手动测试 / 临时补签。每日自动签到由 /api/cron 统一调度（见 lib/cron.js 与 app/api/cron/route.js）。
import { NextResponse } from 'next/server';
import { juejinSignin } from '@/lib/juejinSignin';
import { notifyScript } from '@/lib/notify';
import { storeAppendList } from '@/lib/store';

export const maxDuration = 60;

export async function GET() {
  const cookie = process.env.JUEJIN_COOKIE;
  const r = await juejinSignin(cookie, { timeout: 50 });
  const logsText = r.logs.join('\n');

  try {
    await storeAppendList('panel:logs:juejin', {
      time: Date.now(),
      status: r.ok ? 'success' : 'failed',
      logs: logsText,
      trigger: 'manual',
    });
  } catch {}

  if (process.env.JUEJIN_NOTIFY !== 'false') {
    try {
      await notifyScript({ name: '掘金签到(浏览器)' }, r.ok, logsText);
    } catch {}
  }

  return NextResponse.json(r);
}
