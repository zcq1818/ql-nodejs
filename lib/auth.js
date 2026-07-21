// 鉴权：访问密码 -> token（base64，可跨 Edge/Node 运行）
function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export const COOKIE_NAME = 'panel_token';

function expectedPlain() {
  return 'panel::' + (process.env.PANEL_PASSWORD || 'change_me_strong_password');
}

export function makeToken() {
  return b64encode(expectedPlain());
}

export function verifyToken(token) {
  if (!token) return false;
  try {
    return b64decode(token) === expectedPlain();
  } catch {
    return false;
  }
}
