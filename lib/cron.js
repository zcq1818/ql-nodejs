// 调度判断：根据脚本的 cron 表达式，判断当前是否到了该跑的时刻
import cronParser from 'cron-parser';

export function shouldRun(script, now = Date.now()) {
  if (!script || !script.enabled) return false;
  if (!script.cron) return false;
  try {
    const interval = cronParser.parseExpression(script.cron, {
      currentDate: new Date(now),
    });
    const prev = interval.prev().toDate().getTime(); // 上一次理论触发时刻
    const last = script.lastRun ? new Date(script.lastRun).getTime() : 0;
    return last < prev;
  } catch (e) {
    return false;
  }
}
