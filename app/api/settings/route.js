import { NextResponse } from 'next/server';
import { storeGet, storeSet, KV_ENABLED } from '@/lib/store';
const KEY = 'panel:settings';

// 强制运行时执行：否则 Next 在构建期把 GET 预渲染成静态资源，Vercel 上对 PUT/OPTIONS 一律返回 405
export const dynamic = 'force-dynamic';

export async function GET() {
  const s = await storeGet(KEY, {});
  return NextResponse.json(s);
}

export async function PUT(req) {
  const body = await req.json().catch(() => ({}));
  const cur = await storeGet(KEY, {});
  const merged = { ...cur, ...body };
  try {
    await storeSet(KEY, merged);
  } catch (e) {
    return NextResponse.json(
      { error: '存储写入失败：' + (e?.message || '未知错误') },
      { status: 500 },
    );
  }
  // 未配置 KV/Redis 时，存储退化为内存，重启/新实例后丢失，需要提示用户
  const warn = KV_ENABLED
    ? undefined
    : '当前未配置 KV/Redis，设置仅本次进程有效（Vercel 每次调用可能丢失）。请在 Vercel 环境变量配置 Upstash Redis 或 Vercel KV 以持久化。';
  return NextResponse.json({ ...merged, _warn: warn });
}
