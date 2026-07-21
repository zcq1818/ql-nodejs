# Vercel 任务面板（轻量版「青龙」）

一个跑在 Vercel 上的极简定时任务面板：在网页里提交 Node.js 脚本、设置 cron、由
Vercel Cron 自动执行，支持变量注入、执行日志、失败重试、微信/邮件通知。
适合托管各类「自动签到」「信息推送」类轻量脚本。

## 功能
- 脚本管理：增 / 删 / 改 / 查，每个脚本独立 cron 表达式
- 变量注入：脚本的 `vars`（JSON）会作为**环境变量**注入执行进程（如 `COOKIE`）
- 调度：Vercel Cron（Hobby 每天一次）触发 dispatcher，按「每日去重」运行当天未跑过的脚本
- 立即运行：面板上一键手动触发
- 执行日志：保留最近 200 条，面板内查看
- 失败重试：每个脚本可设重试次数
- 通知：微信 Server 酱 + 邮件（SMTP），成功/失败均可推送
- 鉴权：面板访问密码（Cookie Token），`/api/cron` 可用 `CRON_SECRET` 保护

## 目录结构
```
app/api/        API 路由（login/logout/scripts/cron/settings…）
app/           页面（登录、面板）
components/     Dashboard 客户端组件
lib/           store(存储) / auth(鉴权) / runner(执行) / cron(调度) / notify(通知)
middleware.js  路由鉴权
vercel.json    Cron 配置
examples/      示例脚本（juejin-signin.js）
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
- cron：`0 8 * * *`（每天一次；Hobby 下所有脚本统一在 Vercel Cron 触发时刻运行，此字段仅作记录）
- vars（JSON）：`{ "COOKIE": "你的掘金cookie" }`
- 代码：直接粘贴 `examples/juejin-signin.js` 内容（或任何 Node 脚本）
- 脚本以独立 `node` 进程运行，可用 `fetch`、全局变量、顶层 await、打印日志。

## 安全提醒
- 这个面板**能执行任意代码**，等同于在你 Vercel 账号上开了一个 RCE 口子。
- 务必设置强 `PANEL_PASSWORD`，并配置 `CRON_SECRET`，不要泄露给任何人。
- 不要把它部署到公共/共享环境。

## 已知限制
- Vercel 函数有执行时长上限（免费版约 10–60s），适合**轻量 API 脚本**。
- 像 Playwright 这种要开浏览器的脚本会超时/超限，**不适合跑在 Vercel**；
  这类需求请在本地或支持 Docker 的平台上跑。
- 掘金抽奖接口需 `a_bogus` 风控签名，纯 API 易失败，示例脚本仅做签到。

## 升级提示
- `next@14.2.5` 有已知安全更新，部署前建议 `npm install next@latest` 升级到补丁版本。
- `@vercel/kv` 已彻底移除，存储层现为零依赖的 Upstash REST 直连（见 `lib/store.js`）。
