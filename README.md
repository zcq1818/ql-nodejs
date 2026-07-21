# Vercel 任务面板（轻量版「青龙」）

一个跑在 Vercel 上的极简定时任务面板：在网页里提交 Node.js / Python 脚本、设置 cron、由
Vercel Cron 自动执行，支持变量注入、执行日志、失败重试、微信/邮件通知。
面板自带 **CodeMirror 语法高亮编辑器**、**多文件脚本**、**运行控制台**，体验接近轻量 IDE。
适合托管各类「自动签到」「信息推送」类轻量脚本。

## 功能
- 脚本管理：增 / 删 / 改 / 查，每个脚本独立 cron 表达式
- **多文件脚本**：单个脚本可含多个文件（主文件 + 工具模块），运行时一起落盘、可互相 `require`/`import`
- **代码编辑器**：CodeMirror 6，JS / Python 语法高亮、行号、暗色主题，随语言自动切换
- **运行控制台**：编辑脚本时点「运行」即可把 `stdout/stderr` 实时打到编辑器下方（在线调试排错）
- 变量注入：脚本的 `vars`（JSON）会作为**环境变量**注入执行进程（如 `COOKIE`）
- 调度：Vercel Cron（Hobby 每天一次）触发 dispatcher，按「每日去重」运行当天未跑过的脚本
- 立即运行：面板上一键手动触发
- 执行日志：保留最近 200 条，面板内查看
- 失败重试：每个脚本可设重试次数
- 通知：微信 Server 酱 + 邮件（SMTP），成功/失败均可推送
- 鉴权：面板访问密码（Cookie Token），`/api/cron` 可用 `CRON_SECRET` 保护
- 语言：JS（Node，Vercel 原生）或 Python（仅标准库，Vercel 可能未装 python3）

## 目录结构
```
app/api/        API 路由（login/logout/scripts/cron/settings…）
app/           页面（登录、面板）
components/     Dashboard 客户端组件
lib/           store(存储) / auth(鉴权) / runner(执行) / cron(调度) / notify(通知)
middleware.js  路由鉴权
vercel.json    Cron 配置
examples/      示例脚本（juejin-signin.js / example-python.py / multifile-demo/）
```

## 本地开发
```bash
cp .env.example .env.local      # 填入 PANEL_PASSWORD
npm install
npm run dev                     # http://localhost:3000
```
> 本地未配置 KV 环境变量时会自动退化为**内存存储**（重启即清空），仅便于调试。

## 部署到 Vercel
1. 把本目录推到 GitHub，在 Vercel 导入该仓库。
2. 配置环境变量（Project Settings → Environment Variables）：
   - `PANEL_PASSWORD`（**必填**，面板访问密码，务必设强密码）
   - `CRON_SECRET`（建议，保护 `/api/cron`，Vercel Cron 会自动带 `Bearer <CRON_SECRET>`）
   - 可选通知：`SERVER_KEY`（微信 Server 酱）、`SMTP_HOST/PORT/USER/PASS`、`NOTIFY_TO`
3. 配置存储（持久化脚本/日志）：
   - Vercel KV **已官方弃用**，新项目请用 **Upstash Redis**：
     Vercel Marketplace 搜 Redis → 创建 → 自动注入 `KV_REST_API_URL` / `KV_REST_API_TOKEN`。
   - 面板**不再依赖 `@vercel/kv`**，改用原生 `fetch` 直连 Upstash REST 端点，零额外依赖、打包更稳。
     它读取 `KV_REST_API_URL`/`KV_REST_API_TOKEN`，也兼容 Upstash 原生命名 `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`。
   - 若完全不配置，则会退化为内存存储（**不适合生产**，实例重建数据即丢）。
4. Cron 频率（重要）：`vercel.json` 现为 `0 0 * * *`（**每天 UTC 00:00 = 北京时间 08:00，每天一次**）。
   - **为什么改成每天一次**：Vercel Hobby 计划每天只能触发一次 Cron，原来的 `*/15 * * * *`
     （每 15 分钟）会触发"每天多次"而被拒绝。
   - 调度语义已改为**「每日去重」**：每次触发时，运行所有"今天还没跑过"的脚本。因此每天一次触发
     即可保证每个脚本每天执行一次，脚本各自的 cron 字段仅作记录展示（具体时刻不再严格区分）。
   - 若升级到 Pro 并想恢复"各脚本按各自 cron 时刻分别执行"，把 `vercel.json` 改回高频（如 `*/15 * * * *`）
     并设环境变量 `SCHEDULE_MODE=cron` 即可。
5. 部署完成后访问域名 → 用 `PANEL_PASSWORD` 登录 → 「添加脚本」。

## 提交一个脚本
- 名称：如 `掘金签到`
- 语言：JS（默认）或 Python（仅标准库）
- cron：`0 8 * * *`（每天一次；Hobby 下所有脚本统一在 Vercel Cron 触发时刻运行，此字段仅作记录）
- vars（JSON）：`{ "COOKIE": "你的掘金cookie" }`
- 代码：在 CodeMirror 编辑器里粘贴 `examples/juejin-signin.js` 内容（或任何 Node 脚本）；
  点「▶ 运行（看输出）」可直接在下方控制台看到执行结果
- 脚本以独立进程运行，可用 `fetch`、全局变量、顶层 await、打印日志。

### 多文件脚本
- 点「＋ 新文件」可新增文件；点文件名标签切换；「×」删除（至少保留一个）。
- 「当前文件」框可改名；「入口文件」下拉选择运行时从哪个文件开始执行。
- **JS**：入口文件按 ESM 运行，文件间用 `import { x } from './helper.js'`（注意带扩展名）互相引用；
  参考 `examples/multifile-demo/`（`main.js` + `helper.js`）。
- **Python**：同目录下的文件用 `import helper` 互相引用即可。
- 变量仍通过环境变量注入，与单文件脚本一致（`process.env.COOKIE` / `os.environ.get('COOKIE')`）。

## 安全提醒
- 这个面板**能执行任意代码**，等同于在你 Vercel 账号上开了一个 RCE 口子。
- 务必设置强 `PANEL_PASSWORD`，并配置 `CRON_SECRET`，不要泄露给任何人。
- 不要把它部署到公共/共享环境。

## 已知限制
- Vercel 函数有执行时长上限（免费版约 10–60s），适合**轻量 API 脚本**。
- 像 Playwright 这种要开浏览器的脚本会超时/超限，**不适合跑在 Vercel**；
  这类需求请在本地或支持 Docker 的平台上跑。
- 掘金抽奖接口需 `a_bogus` 风控签名，纯 API 易失败，示例脚本仅做签到。
- **Python 限制**：Vercel 免费 Serverless 不保证预装 `python3`，且**无法 `pip install`**，
  所以 Python 脚本只能用标准库；纯 API 类任务更推荐用 JS（Node 原生 `fetch`）。
- **"在线调试"说明**：面板的「运行控制台」能显示 `stdout/stderr` 用于排错，但 Vercel 是无状态
  短函数，**不支持断点单步 / 变量监视**这类真·调试；需要逐步调试请在本地 Node/Python 环境进行。

## 升级提示
- `next@14.2.5` 有已知安全更新，部署前建议 `npm install next@latest` 升级到补丁版本。
- `@vercel/kv` 已彻底移除，存储层现为零依赖的 Upstash REST 直连（见 `lib/store.js`）。

## 排障：Vercel 报 "No entrypoint found"（package.json "main"）
这是**框架识别错误**：Vercel 把项目当成了纯 Node.js 应用，去翻 `package.json` 的 `main`
入口（`index.js`/`app.js` 等），找不到就报错。本项目是 Next.js，不该走 Node.js 运行时。

**修复（在 Vercel 控制台，不丢已配环境变量）：**
1. 项目 **Settings → General → Framework Preset** 改成 **Next.js**（关键）。
2. **Build & Development Settings** 确认：
   - Build Command：`next build`；Output Directory：`.next`；
   - Install Command：`npm install`；Root Directory：`./`（仓库根，非子目录）。
3. **Save** → **Deployments → 最新部署 → Redeploy**。

**备选**：若担心 Vercel 缓存了旧判断，删掉项目重新 **Import** `zcq1818/ql-nodejs`
（重新导入会自动识别为 Next.js），但环境变量需重填。

> 附：`3 packages are looking for funding` / `npm fund` 只是无害提示，不是错误。
