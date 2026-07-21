// 脚本执行引擎：把脚本的全部文件写到临时目录，用独立进程运行入口文件（像青龙一样），
// 注入脚本变量为环境变量，捕获 stdout/stderr，超时 kill。
// 支持 language: 'js'（默认，用 node 跑，支持多文件 ESM 互相 import）或 'python'（python3/python，同目录 import）。
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { normalizeFiles, resolveEntry } from './scriptModel';

const execFileP = promisify(execFile);

// 在 PATH 中探测可用的 python 解释器（Vercel 免费环境可能未安装）
function pickPython() {
  for (const c of ['python3', 'python']) {
    try {
      execFileSync(c, ['--version'], { stdio: 'ignore' });
      return c;
    } catch {}
  }
  return null;
}

export async function runScript(script, opts = {}) {
  const lang = (script.language || 'js').toLowerCase();
  const files = normalizeFiles(script);
  const entry = resolveEntry(script.entry, files, lang);
  if (!entry) {
    return { ok: false, logs: '[error] 没有可执行的入口文件' };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `task_${script.id}_`));
  let logs = '';
  try {
    // 写入全部文件（仅 basename，防目录穿越）
    for (const f of files) {
      const base = path.basename(f.name);
      fs.writeFileSync(path.join(dir, base), f.content, 'utf8');
    }
    // Node 用 ESM：写入 package.json 让 .js 以模块解析，支持 import './utils.js'
    if (lang === 'js') {
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
    }
    const timeout = (opts.timeout || 55) * 1000;
    const env = { ...process.env, ...(script.vars || {}) };
    let command, args;
    if (lang === 'python') {
      const py = pickPython();
      if (!py) {
        return {
          ok: false,
          logs: '[error] 当前运行环境未找到 python 解释器（Vercel 免费 Serverless 可能未安装 python3），无法运行 Python 脚本。\n'
            + '建议：① 改用 JS 脚本（Node 原生支持）；② 或把脚本部署到自带 Python 的环境。',
        };
      }
      command = py;
      args = [entry];
    } else {
      command = process.execPath;
      args = [entry];
    }
    const { stdout, stderr } = await execFileP(command, args, {
      timeout,
      env,
      cwd: dir,
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
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}
