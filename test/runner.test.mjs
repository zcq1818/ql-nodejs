// 执行引擎单测：不依赖 HTTP / KV，直接用 node 跑。
// runner.js 是 ESM 源码，复制为 .mjs 再动态导入（避免 package 非 ESM 时解析失败）。
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { pathToFileURL } from 'url';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// runner.js 依赖同目录的 scriptModel.js，一起复制到临时目录并以 .mjs 形式导入
const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'runner_test_'));
let runnerSrc = readFileSync(path.join(__dirname, '../lib/runner.js'), 'utf8').replace(
  "from './scriptModel'",
  "from './scriptModel.mjs'"
);
writeFileSync(path.join(tmpDir, 'runner.mjs'), runnerSrc);
writeFileSync(
  path.join(tmpDir, 'scriptModel.mjs'),
  readFileSync(path.join(__dirname, '../lib/scriptModel.js'), 'utf8')
);
const { runScript } = await import(pathToFileURL(path.join(tmpDir, 'runner.mjs')).href);

let failed = 0;
async function assert(cond, msg) {
  if (cond) {
    console.log('  ✅ ' + msg);
  } else {
    console.error('  ❌ FAIL: ' + msg);
    failed++;
  }
}

console.log('\n[1] 成功场景 + 环境变量注入');
const r1 = await runScript(
  { id: 't1', code: 'console.log("FOO=" + process.env.FOO); console.log("done");', vars: { FOO: 'bar' } },
  { timeout: 10 }
);
await assert(r1.ok === true, '有变量时应成功 (ok=true)');
await assert(r1.logs.includes('FOO=bar'), '应将 vars.FOO 注入为环境变量');

console.log('\n[2] 失败场景：脚本 exit(1) 且捕获 stderr');
const r2 = await runScript(
  { id: 't2', code: 'console.error("something broke"); process.exit(1);', vars: {} },
  { timeout: 10 }
);
await assert(r2.ok === false, 'exit(1) 应判为失败 (ok=false)');
await assert(r2.logs.includes('something broke'), '应捕获 stderr 输出');

console.log('\n[3] 超时场景：死循环应在 timeout 后被 kill');
const t0 = Date.now();
const r3 = await runScript({ id: 't3', code: 'while(true){}', vars: {} }, { timeout: 2 });
const cost = Date.now() - t0;
await assert(r3.ok === false, '超时应判为失败');
await assert(cost < 8000, `超时进程应被 kill (实际耗时 ${cost}ms < 8s)`);

console.log('\n[4] 正常退出码 0');
const r4 = await runScript({ id: 't4', code: 'console.log("ok");', vars: {} }, { timeout: 10 });
await assert(r4.ok === true, '无错误退出应为成功');

console.log('\n' + (failed === 0 ? '🎉 全部通过' : `⚠️  ${failed} 项失败`));
process.exit(failed === 0 ? 0 : 1);
