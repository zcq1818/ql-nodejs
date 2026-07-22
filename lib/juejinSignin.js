// 掘金签到（无头浏览器版）
// ----------------------------------------------------------------------------
// 在 Vercel lambda 内用 Playwright + @sparticuz/chromium 启动一个真实的无头 Chrome，
// 由浏览器自身完成「访问签到页 -> 点击签到」全流程，从而让掘金页面自己的 JS 生成
// 风控签名 a_bogus。这是目前唯一能在无浏览器环境（如 Vercel）稳定跑通的方案，
// 因为纯 API 调用会因缺少 a_bogus 而返回空响应。
//
// 使用方式：
//   1) 在 Vercel 环境变量里设置 JUEJIN_COOKIE = 浏览器复制的 cookie 整串
//   2) 每日 cron（/api/cron）会自动执行；也可手动访问 /api/juejin 触发
// ----------------------------------------------------------------------------
import { chromium } from 'playwright-core';
import chromiumS3 from '@sparticuz/chromium';

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
      const name = pair.slice(0, idx);
      const value = pair.slice(idx + 1);
      // Playwright 要求 cookie 只给 domain+path 或只给 url，二者不能同时给
      return { name, value, domain: '.juejin.cn', path: '/' };
    });
}

export async function juejinSignin(cookie, { timeout = 50 } = {}) {
  const logs = [];
  const log = (m) => {
    logs.push(String(m));
    console.log(m);
  };
  if (!cookie) {
    log('[skip] 未设置 JUEJIN_COOKIE，跳过浏览器签到');
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
