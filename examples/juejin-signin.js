// 掘金每日签到（纯 API 版，已淘汰）
// ----------------------------------------------------------------------------
// ⚠️ 此「纯 API」版在 Vercel / 无浏览器环境下会因 check_in 缺少 a_bogus 风控签名
// 而返回空响应，无法成功。请改用项目内置的「无头浏览器签到」：
//
//   1) 在 Vercel 环境变量设置  JUEJIN_COOKIE = 浏览器复制的 cookie 整串
//   2) 每日 cron 会自动执行（见 lib/juejinSignin.js + app/api/juejin/route.js）
//   3) 手动测试：访问 /api/juejin
//
// 本文件仅保留作为「纯 API 请求长什么样」的参考，不要再作为定时脚本启用。
// ----------------------------------------------------------------------------

const COOKIE = process.env.COOKIE;
if (!COOKIE) {
  console.error('缺少 COOKIE 变量');
  process.exit(1);
}

// ---- 对应 parse-cookietokens.ts：从 cookie 解析 aid / uuid ----
function parseCookieTokens(cookie) {
  const tokensReg = /^__tea_cookie_tokens_(\d+)$/;
  const stack = {};
  cookie.split('; ').forEach((pair) => {
    const idx = pair.indexOf('=');
    const k = pair.slice(0, idx);
    const v = pair.slice(idx + 1);
    stack[k] = v;
  });
  for (const key of Object.keys(stack)) {
    if (tokensReg.test(key)) {
      const aid = key.match(tokensReg)[1];
      try {
        const json = JSON.parse(decodeURIComponent(decodeURIComponent(stack[key])));
        return { aid, uuid: json.user_unique_id || '' };
      } catch (e) {
        return { aid, uuid: '' };
      }
    }
  }
  return { aid: '2608', uuid: '0' };
}

const HDR = {
  'User-Agent': 'Mozilla/5.0',
  Referer: 'https://juejin.cn/',
  Origin: 'https://juejin.cn/',
};
const { aid: AID, uuid: UUID } = parseCookieTokens(COOKIE);
console.log(`[token] 解析到 aid=${AID}, uuid=${UUID}`);

const BASE = 'https://api.juejin.cn';

// 对应 growth.ts 的请求拦截器：growth_api 接口自动拼接 aid & uuid
function withQs(path) {
  if (path.includes('growth_api')) {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}aid=${AID}&uuid=${UUID}`;
  }
  return path;
}

async function callApi(path, method = 'GET', body) {
  const r = await fetch(BASE + withQs(path), {
    method,
    headers: { ...HDR, Cookie: COOKIE, 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
  });
  const txt = await r.text();
  console.log(`[${method} ${path}] HTTP ${r.status} | body=${JSON.stringify(txt).slice(0, 220)}`);
  if (!txt) {
    console.error('空响应 → 该仓库纯 API 在 check_in 上会因缺少 a_bogus/浏览器预热而失败');
    process.exit(1);
  }
  let j;
  try {
    j = JSON.parse(txt);
  } catch (e) {
    console.error('响应不是 JSON:', txt);
    process.exit(1);
  }
  if (j.err_no) {
    console.error('接口报错:', j.err_msg);
    process.exit(1);
  }
  return j.data;
}

(async () => {
  try {
    // 对应 index.ts login：验证登录
    const user = await callApi('/user_api/v1/user/get', 'GET');
    console.log(`登录用户: ${user.user_name}`);

    // 对应 GrowthTask.run
    const todayStatus = await callApi('/growth_api/v1/get_today_status', 'GET');
    if (todayStatus) {
      console.log('今日已完成签到');
    } else {
      const res = await callApi('/growth_api/v1/check_in', 'POST');
      console.log(`签到成功 +${res.incr_point} 矿石，当前 ${res.sum_point} 矿石`);
    }

    const counts = await callApi('/growth_api/v1/get_counts', 'GET');
    console.log(`连续签到 ${counts.cont_count} 天，累计 ${counts.sum_count} 天`);

    const point = await callApi('/growth_api/v1/get_cur_point', 'GET');
    console.log(`当前矿石数 ${point}`);
  } catch (e) {
    console.error('异常:', e.message);
    process.exit(1);
  }
})();
