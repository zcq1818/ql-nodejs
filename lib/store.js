// 存储层：优先用 Upstash Redis（REST API，零依赖，兼容 Vercel KV 变量名），
// 否则退化为内存（仅本地开发 / 未配置存储时）。
// 之所以不依赖 @vercel/kv：该包已官方弃用，且其 ESM 依赖树在 Vercel 函数打包器里
// 曾导致入口文件解析失败（SyntaxError: Unexpected end of input）。直接用 fetch 调
// Upstash REST 端点最干净、最稳。
let mem = null;
function getMem() {
  if (!mem) mem = new Map();
  return mem;
}

function kvConfig() {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (url && token) return { url: url.replace(/\/+$/, ''), token };
  return null;
}
const KV_ENABLED = !!kvConfig();

async function rest(command) {
  const cfg = kvConfig();
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`Upstash error: ${data.error}`);
  return data.result;
}

function deserialize(v) {
  if (v === null || v === undefined) return v;
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}

export async function storeGet(key, fallback) {
  if (KV_ENABLED) {
    try {
      const v = await rest(['get', key]);
      const val = deserialize(v);
      return val === undefined || val === null ? fallback : val;
    } catch (e) {
      console.error('[store] read error:', e.message);
      return fallback;
    }
  }
  const m = getMem();
  return m.has(key) ? m.get(key) : fallback;
}

export async function storeSet(key, value) {
  if (KV_ENABLED) {
    try {
      await rest(['set', key, JSON.stringify(value)]);
    } catch (e) {
      throw new Error(`Redis 写入失败：${e.message}`);
    }
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
