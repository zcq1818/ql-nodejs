// 调度判断
// ----------------------------------------------------------------------------
// 设计说明（重要）：
// - Vercel Hobby 计划每天只能触发一次 Cron，因此本面板默认采用「每日去重」策略：
//   每次被（每天唯一的）Cron 触发时，运行所有「今天还没成功运行过」的已启用脚本。
//   这样无论各脚本的 cron 表达式设的是几点，只要在当天被触发一次，就能保证每天跑一次。
// - 若升级到 Pro 并改回高频 Cron（如 */15），由于当天首次触发已跑完并写回 lastRun，
//   后续当天触发会自动跳过，天然去重，不会重复执行。
// - 若需要「严格按各脚本 cron 时刻分别执行」（仅在 Pro + 高频 Cron 下才有意义），
//   设置环境变量 SCHEDULE_MODE=cron 即可切换回 cron 匹配模式。
// ----------------------------------------------------------------------------

import cronParser from 'cron-parser';

function startOfToday(now) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function ranToday(script, now) {
  if (!script || !script.lastRun) return false;
  return new Date(script.lastRun).getTime() >= startOfToday(now);
}

const STRICT = process.env.SCHEDULE_MODE === 'cron';

export function shouldRun(script, now = Date.now()) {
  if (!script || !script.enabled) return false;

  // 当天已跑过 -> 去重跳过（核心逻辑，Hobby / Pro 都适用）
  if (ranToday(script, now)) return false;

  if (STRICT) {
    // 严格 cron 匹配模式：仅当脚本的 cron 上一次理论触发已在 lastRun 之后才跑
    if (!script.cron) return true;
    try {
      const prev = cronParser
        .parseExpression(script.cron, { currentDate: new Date(now) })
        .prev()
        .toDate()
        .getTime();
      const last = script.lastRun ? new Date(script.lastRun).getTime() : 0;
      return last < prev;
    } catch {
      return true;
    }
  }

  // 默认（每日去重）模式：今天还没跑就跑
  return true;
}
