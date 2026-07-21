// 脚本执行引擎：把脚本写到 /tmp，用独立 node 进程运行（像青龙一样），
// 注入脚本变量为环境变量，捕获 stdout/stderr，超时 kill。
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileP = promisify(execFile);

export async function runScript(script, opts = {}) {
  const tmp = path.join(os.tmpdir(), `task_${script.id}_${Date.now()}.js`);
  fs.writeFileSync(tmp, script.code, 'utf8');
  const timeout = (opts.timeout || 55) * 1000;
  const env = { ...process.env, ...(script.vars || {}) };
  let logs = '';
  try {
    const { stdout, stderr } = await execFileP(process.execPath, [tmp], {
      timeout,
      env,
      maxBuffer: 1024 * 1024 * 5,
    });
    logs += stdout;
    if (stderr) logs += '\n[stderr]\n' + stderr;
    return { ok: true, logs };
  } catch (e) {
    logs += '\n[error] ' + (e.message || e);
    if (e.stdout) logs += '\n' + e.stdout;
    if (e.stderr) logs += '\n' + e.stderr;
    return { ok: false, logs };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {}
  }
}
