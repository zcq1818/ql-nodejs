// 多文件脚本示例：演示如何在面板里把代码拆成多个文件并互相 import
// 在面板「添加脚本」时，语言选 JavaScript，建两个文件 main.js / helper.js，
// 入口文件选 main.js，即可运行。
import { greet } from './helper.js';

const COOKIE = process.env.COOKIE;
console.log(greet('掘金签到'));

if (!COOKIE) {
  console.error('缺少 COOKIE 变量');
  process.exit(1);
}
console.log('COOKIE 前 8 位：', COOKIE.slice(0, 8));
