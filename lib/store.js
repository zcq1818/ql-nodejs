// 存储层：有 Vercel KV 环境变量时用 KV，否则退化为内存（仅本地开发）
let mem = null;
function getMem() {
  if (!mem) mem = new Map();
  return mem;
}
const KV_ENABLED = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

async function getKv() {
  if (!KV_ENABLED) return null;
  const { kv } = await import('@vercel/kv');
  return kv;
}

export async function storeGet(key, fallback) {
  if (KV_ENABLED) {
    try {
      const kv = await getKv();
      const v = await kv.get(key);
      return v === undefined || v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  const m = getMem();
  return m.has(key) ? m.get(key) : fallback;
}

export async function storeSet(key, value) {
  if (KV_ENABLED) {
    const kv = await getKv();
    await kv.set(key, value);
    return;
  }
  getMem().set(key, value);
}

export async function storeAppendList(key, item, max = 200) {
  const list = await storeGet(key, []);
  list.push(item);
  if (list.length > max) list.splice(0, list.length - max);
  await storeSet(key, list);
}
