// 脚本模型辅助：把脚本归一化为「多文件」结构，并解析入口文件。
// 兼容旧版单 code 脚本（无 files 时用 code 生成单文件）。

// 清洗文件名：只允许 字母/数字/._-，去掉路径分隔符，防止目录穿越
function safeName(name, fallback) {
  const cleaned = String(name || '').replace(/[^\w.\-]/g, '_');
  return cleaned || fallback;
}

export function normalizeFiles(script) {
  if (Array.isArray(script.files) && script.files.length > 0) {
    return script.files.map((f) => ({
      name: safeName(f.name, 'file.txt'),
      content: String(f.content || ''),
    }));
  }
  // 旧版：单一 code
  const lang = (script.language || 'js').toLowerCase();
  const ext = lang === 'python' ? '.py' : '.js';
  return [{ name: 'main' + ext, content: String(script.code || '') }];
}

export function resolveEntry(entry, files, lang) {
  if (entry && files.some((f) => f.name === entry)) return entry;
  const prefer = lang === 'python' ? ['main.py', 'index.py'] : ['main.js', 'index.js'];
  for (const p of prefer) {
    if (files.some((f) => f.name === p)) return p;
  }
  return files[0] ? files[0].name : null;
}
