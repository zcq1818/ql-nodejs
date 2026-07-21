// 掘金每日签到（轻量 API 版）
// 用途：在面板里「添加脚本」粘贴本文件，vars 填 { "COOKIE": "你的掘金cookie" }
// 说明：纯 API 签到稳定；掘金抽奖接口需要 a_bogus 风控签名，纯 API 易失败，
//       所以这里只做签到。抽奖建议用本地 Playwright 版或放弃。
const COOKIE = process.env.COOKIE;
if (!COOKIE) {
  console.error('缺少 COOKIE 变量');
  process.exit(1);
}
const BASE = 'https://api.juejin.cn/growth_api/v1';
const AID = '2608', UUID = '0', SPIDER = '0';
const H = { Cookie: COOKIE, 'User-Agent': 'Mozilla/5.0', Referer: 'https://juejin.cn/' };

(async () => {
  const st = await fetch(`${BASE}/get_today_status?aid=${AID}&uuid=${UUID}&spider=${SPIDER}`, { headers: H }).then((r) => r.json());
  if (st.err_no === 0 && st.data && st.data.check_in_done) {
    console.log('今日已签到，跳过');
    return;
  }
  const res = await fetch(`${BASE}/check_in`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify({ aid: AID, uuid: UUID, spider: SPIDER }),
  }).then((r) => r.json());
  if (res.err_no === 0) {
    console.log('签到成功，当前积分', res.data && res.data.sum_point);
  } else {
    console.error('签到失败', res.err_msg);
    process.exit(1);
  }
  const ore = await fetch(`${BASE}/get_cur_point?aid=${AID}&uuid=${UUID}&spider=${SPIDER}`, { headers: H }).then((r) => r.json());
  if (ore.err_no === 0) console.log('当前矿石', ore.data);
})().catch((e) => {
  console.error('异常', e.message);
  process.exit(1);
});
