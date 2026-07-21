"""
Python 脚本示例（面板 language 选 "python" 时运行）
- 变量通过环境变量注入，与 JS 的 process.env.COOKIE 对应
- 仅可用标准库（Vercel 免费环境无法 pip install 第三方包）
- 掘金签到接口有 a_bogus 风控签名，纯 API 通常调不通，这里仅作「读取变量 + 发请求」的模板
"""
import os
import sys
import json
import urllib.request

cookie = os.environ.get("COOKIE")
if not cookie:
    print("缺少 COOKIE 变量")
    sys.exit(1)

url = "https://api.juejin.cn/growth_api/v1/check_in"
req = urllib.request.Request(
    url,
    data=b"{}",
    headers={
        "Content-Type": "application/json",
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        body = resp.read().decode("utf-8")
        print("响应:", body)
except Exception as e:
    print("请求失败:", e)
    sys.exit(1)
