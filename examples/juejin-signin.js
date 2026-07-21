// 掘金每日签到（自动从 Cookie 提取 aid/uuid，只需填 COOKIE）
// 参考 iDerekLi/juejin-helper 的解析思路：aid/uuid 来自 cookie 里的 __tea_cookie_tokens_<aid>
const COOKIE = process.env.COOKIE;
if (!COOKIE) {
  console.error('缺少 COOKIE 变量');
  process.exit(1);
}

// 从 cookie 自动提取 aid / uuid（避免写死 uuid=0 导致 check_in 空响应）
function extractTokens(cookie) {
  const m = cookie.match(/__tea_cookie_tokens_(\d+)=([^;]+)/);
  if (m) {
    const aid = m[1];
    try {
      const json = JSON.parse(decodeURIComponent(decodeURIComponent(m[2])));
      const uuid = json.user_unique_id || '';
      console.log(`[token] 从 cookie 解析到 aid=${aid}, uuid=${uuid}`);
      return { aid, uuid };
    } catch (e) {
      console.log('[token] __tea_cookie_tokens_ 解析失败，使用默认值');
    }
  } else {
    console.log('[token] cookie 中未找到 __tea_cookie_tokens_，使用默认值 aid=2608, uuid=0');
  }
  return { aid: '2608', uuid: '0' };
}

const { aid: AID, uuid: UUID } = extractTokens(COOKIE);
const SPIDER = '0';
const BASE = 'https://api.juejin.cn/growth_api/v1';
const H = {
  Cookie: COOKIE,
  'User-Agent': 'Mozilla/5.0',
  Referer: 'https://juejin.cn/',
  Origin: 'https://juejin.cn/',
};

async function call(method, path) {
  const qs = new URLSearchParams({ aid: AID, uuid: UUID, spider: SPIDER }).toString();
  const r = await fetch(`${BASE}/${path}?${qs}`, {
    method,
    headers: method === 'POST' ? { ...H, 'Content-Type': 'application/json' } : H,
    body: method === 'POST' ? JSON.stringify({}) : undefined,
  });
  const txt = await r.text();
  console.log(`[${method} ${path}] HTTP ${r.status} | body=${JSON.stringify(txt)}`);
  if (!txt) {
    console.error('空响应 → 可能是 cookie 失效；若 cookie 有效则 check_in 现在需要 a_bogus 风控签名');
    process.exit(1);
  }
  try {
    return JSON.parse(txt);
  } catch (e) {
    console.error('响应不是 JSON:', txt);
    process.exit(1);
  }
}

(async () => {
  const st = await call('GET', 'get_today_status');
  if (st.err_no === 0 && st.data && st.data.check_in_done) {
    console.log('今日已签到，跳过');
    return;
  }
  if (st.err_no !== 0) {
    console.error('查状态失败:', st.err_msg);
    process.exit(1);
  }

  const res = await call('POST', 'check_in');
  if (res.err_no === 0) {
    console.log('签到成功，当前积分', res.data && res.data.sum_point);
  } else {
    console.error('签到失败', res.err_msg);
    process.exit(1);
  }

  const ore = await call('GET', 'get_cur_point');
  if (ore.err_no === 0) console.log('当前矿石', ore.data);
})().catch((e) => {
  console.error('异常', e.message);
  process.exit(1);
});
