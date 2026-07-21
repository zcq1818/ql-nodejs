// 被 main.js 通过 `import { greet } from './helper.js'` 引入
export function greet(name) {
  return `Hello, ${name}!（来自 helper.js）`;
}
