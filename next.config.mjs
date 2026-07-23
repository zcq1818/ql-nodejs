/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // 关键修复：playwright-core 在 coreBundle.js 里会通过 `require("chromium-bidi/lib/cjs/...")`
  // 引用 chromium-bidi，但 chromium-bidi@5.x 的 exports 字段会把该子路径改写错误，导致
  // Next.js 在构建期（webpack 静态解析）报 "Module not found"。
  // 实际上该 require 只在 BiDi 协议连接时才会执行，而我们走的是 CDP（chromium.launch +
  // @sparticuz/chromium），运行时根本不会触发。因此把这些包从打包中排除，改为运行时 require，
  // 既消除构建错误，又不影响签到/抽奖功能。
  experimental: {
    serverComponentsExternalPackages: [
      'playwright-core',
      '@sparticuz/chromium',
      'chromium-bidi',
    ],
    // Vercel 用 @vercel/nft 追踪部署文件，只会包含被 require/import 的文件；
    // @sparticuz/chromium 的 bin/*.br 是运行时用 fs 读取的，不会被追踪，导致线上
    // 报错「/var/task/node_modules/@sparticuz/chromium/bin 不存在」。这里强制把
    // 整个 bin 目录打进签到相关路由的部署包，首次调用时解压到 /tmp/chromium 复用。
    outputFileTracingIncludes: {
      '/api/juejin': ['./node_modules/@sparticuz/chromium/bin/**'],
      '/api/cron': ['./node_modules/@sparticuz/chromium/bin/**'],
    },
  },
};
export default nextConfig;
