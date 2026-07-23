// 掘金签到（无头浏览器版）
// ----------------------------------------------------------------------------
// 在 Vercel lambda 内用 Playwright + @sparticuz/chromium 启动一个真实的无头 Chrome，
// 由浏览器自身完成「访问签到页 -> 点击签到」全流程，从而让掘金页面自己的 JS 生成
// 风控签名 a_bogus。这是目前唯一能在无浏览器环境（如 Vercel）稳定跑通的方案，
// 因为纯 API 调用会因缺少 a_bogus 而返回空响应。
//
// 使用方式：
//   1) 在面板「设置」页填写 juejinCookie（优先读取，存于 KV/Redis；未配 KV 时退化为
//      各函数独立内存，会读不到，见下方 [hint]）—— 或
//   2) 在 Vercel 环境变量设置 JUEJIN_COOKIE = 浏览器复制的 cookie 整串（兜底，无需 KV）
//   3) 每日 cron（/api/cron）会自动执行；也可手动访问 /api/juejin 触发
// ----------------------------------------------------------------------------
import { chromium } from 'playwright-core';
import chromiumS3 from '@sparticuz/chromium';
import { KV_ENABLED } from '@/lib/store';

const SIGNIN_URL = 'https://juejin.cn/user/center/signin?from=main_page';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';

function parseCookies(cookieStr) {
  if (!cookieStr) return [];
  return cookieStr
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf('=');
      // 跳过没有 '=' 的畸形段（如浏览器复制时混入的 Secure/HttpOnly 字样）
      if (idx <= 0) return null;
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1);
      if (!name) return null;
      // 用 url 注入：Playwright 会从 https URL 自动推导 secure=true 且为 host-only 域名，
      // 从而满足 __Secure-/__Host- 前缀 cookie 的强制约束（否则 CDP 报 Invalid cookie fields）。
      return { name, value, url: 'https://juejin.cn/' };
    })
    .filter(Boolean);
}

export async function juejinSignin(cookie, { timeout = 50 } = {}) {
  const logs = [];
  const log = (m) => {
    logs.push(String(m));
    console.log(m);
  };
  if (!cookie) {
    log('[skip] 未设置 JUEJIN_COOKIE，跳过浏览器签到');
    if (!KV_ENABLED) {
      log('[hint] 若你已在面板设置页填过 juejinCookie 仍看到此提示：Vercel 上每个 API 路由是独立函数、各自的内存不共享，且当前未配置 KV/Redis（存储退化为函数内内存），因此设置页写入的 cookie 对签到接口不可见。');
      log('       解决二选一：① 在 Vercel 配置 Upstash Redis 或 Vercel KV（自动注入 KV_REST_API_URL/KV_REST_API_TOKEN 或 UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN），重新部署后再保存一次；② 直接设 Vercel 环境变量 JUEJIN_COOKIE=你的cookie整串，路由会优先读它。');
    }
    return { ok: false, skipped: true, logs };
  }

  let browser;
  const hardTimeout = setTimeout(() => {
    if (browser) browser.close().catch(() => {});
  }, (timeout + 5) * 1000);

  try {
    log('[init] 准备启动无头浏览器（首次冷启动需下载 chromium，约数秒）...');
    const exe = await chromiumS3.executablePath();
    browser = await chromium.launch({
      executablePath: exe,
      headless: true,
      args: [...chromiumS3.args, '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const context = await browser.newContext({ userAgent: UA });
    const page = await context.newPage();

    // 捕获 check_in / 抽奖 响应，提取结果
    let checkInData = null;
    let checkInErr = null;
    let lottoCfg = null;
    let lottoDraw = null;
    page.on('response', async (resp) => {
      const u = resp.url();
      if (u.includes('/growth_api/v1/check_in')) {
        try {
          const j = await resp.json();
          if (j && j.err_no === 0) {
            checkInData = j.data ?? null;
            log(`[check_in] 成功 err_no=0`);
          } else {
            checkInErr = j?.err_msg || 'unknown';
            log(`[check_in] 接口返回 err_no=${j?.err_no} msg=${j?.err_msg || ''}`);
          }
        } catch {}
      }
      if (u.includes('/growth_api/v1/lottery_config/get')) {
        try { lottoCfg = await resp.json(); } catch {}
      }
      if (u.includes('/growth_api/v1/lottery/draw')) {
        try { lottoDraw = await resp.json(); log(`[lottery/draw] err_no=${lottoDraw?.err_no}`); } catch {}
      }
    });

    // 注入 cookie 并刷新使登录态生效
    await page.goto('https://juejin.cn/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await context.addCookies(parseCookies(cookie));
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });

    // 打开签到页
    await page.goto(SIGNIN_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('button', { timeout: 10000 }).catch(() => {});

    // 尝试点击「立即签到」
    let clicked = false;
    for (const sel of [
      page.getByRole('button', { name: /立即签到/ }),
      page.locator('button:has-text("立即签到")'),
    ]) {
      if (await sel.isVisible().catch(() => false)) {
        await sel.click();
        clicked = true;
        break;
      }
    }

    if (clicked) {
      log('[action] 已点击「立即签到」，等待接口返回...');
      await page.waitForTimeout(3500);
      if (checkInData) {
        log(`签到成功 +${checkInData.incr_point} 矿石，当前 ${checkInData.sum_point} 矿石 🎉`);
      } else if (checkInErr) {
        log('签到接口报错：' + checkInErr);
      } else {
        log('已点击签到，但未捕获到 check_in 响应（可能已签到或触发风控）');
      }
    } else {
      log('未找到「立即签到」按钮，可能今日已完成签到 ✅');
    }

    // ---- 每日免费抽奖（签到后有一次免费机会）----
    log('[lottery] 打开抽奖页...');
    lottoCfg = null;
    lottoDraw = null;
    await page.goto('https://juejin.cn/user/center/lottery?from=lucky_lottery_menu_bar', {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    await page.waitForTimeout(2500);
    const free = lottoCfg?.data?.free_count;
    if (free === 0) {
      log('[lottery] 今日免费抽奖已用');
    } else if (free > 0) {
      log(`[lottery] 有 ${free} 次免费抽奖，点击抽奖...`);
      const drawBtn = page.locator('div.text.text-free').first();
      if (await drawBtn.isVisible().catch(() => false)) {
        await drawBtn.click();
        await page.waitForTimeout(4000);
        if (lottoDraw && lottoDraw.err_no === 0) {
          log(`抽奖成功：${lottoDraw.data?.lottery_name}，幸运值 +${lottoDraw.data?.draw_lucky_value}（当前 ${lottoDraw.data?.total_lucky_value}）🎉`);
        } else if (lottoDraw) {
          log(`抽奖接口报错：err_no=${lottoDraw.err_no} msg=${lottoDraw.err_msg}`);
        } else {
          log('已点击抽奖，但未捕获 draw 响应');
        }
      } else {
        log('有免费次数但找不到抽奖按钮');
      }
    } else {
      log('未拿到抽奖免费次数（lottery_config 未返回）');
    }

    await browser.close();
    clearTimeout(hardTimeout);
    return { ok: true, logs, data: checkInData };
  } catch (e) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    clearTimeout(hardTimeout);
    log('[error] 异常: ' + (e?.message || e));
    return { ok: false, logs, error: String(e?.message || e) };
  }
}
