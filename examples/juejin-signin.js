// 掘金每日签到 —— 解析自 github.com/iDerekLi/juejin-helper（main 分支）
// 对应源码：packages/juejin-helper/src/growth.ts + utils/parse-cookietokens.ts + workflows/checkin.js
// 说明：该仓库签到本质是纯 API（check_in 不带 a_bogus），能否成功依赖它额外的
// 「浏览器访问签到页」预热步骤（MockVisitTask）。本脚本只还原纯 API 部分。
//
// 面板 vars 只需：{ "COOKIE": "浏览器复制的 cookie 整串" }

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
