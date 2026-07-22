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
  },
};
export default nextConfig;
