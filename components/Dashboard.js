'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CodeEditor from './CodeEditor';

const card = { background: '#171a21', border: '1px solid #262b36', borderRadius: 8, padding: 16, margin: '12px 0' };
const btn = { background: '#2d6cdf', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', marginRight: 6 };
const btn2 = { background: '#2b3140', color: '#e6e6e6', border: '1px solid #3a4252', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', marginRight: 6 };
const input = { width: '100%', padding: 8, margin: '4px 0', boxSizing: 'border-box', background: '#0f1115', color: '#fff', border: '1px solid #262b36', borderRadius: 6, fontFamily: 'inherit' };
const ta = { ...input, minHeight: 70, fontFamily: 'monospace', whiteSpace: 'pre' };

function blankForm() {
  return { name: '', language: 'js', cron: '0 8 * * *', vars: '{}', files: [{ name: 'main.js', content: '' }], entry: 'main.js', enabled: true, retries: 0, notify: true };
}

export default function Dashboard() {
  const router = useRouter();
  const [scripts, setScripts] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [activeFile, setActiveFile] = useState(0);
  const [consoleOut, setConsoleOut] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [logs, setLogs] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [s, st] = await Promise.all([
      fetch('/api/scripts').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
    ]);
    setScripts(Array.isArray(s) ? s : []);
    setSettings(st || {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })); }

  function editScript(s) {
    const files = (Array.isArray(s.files) && s.files.length)
      ? s.files.map((f) => ({ name: f.name, content: f.content || '' }))
      : [{ name: s.language === 'python' ? 'main.py' : 'main.js', content: s.code || '' }];
    setEditing(s);
    setForm({
      name: s.name,
      language: s.language || 'js',
      cron: s.cron || '0 8 * * *',
      vars: JSON.stringify(s.vars || {}, null, 2),
      files,
      entry: s.entry || files[0].name,
      enabled: s.enabled !== false,
      retries: s.retries || 0,
      notify: s.notify !== false,
    });
    setActiveFile(0);
    setConsoleOut(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setFileContent(v) {
    setForm((f) => ({ ...f, files: f.files.map((file, idx) => (idx === activeFile ? { ...file, content: v } : file)) }));
  }
  function addFile() {
    const ext = form.language === 'python' ? '.py' : '.js';
    const name = `file${form.files.length + 1}${ext}`;
    setForm((f) => ({ ...f, files: [...f.files, { name, content: '' }] }));
    setActiveFile(form.files.length);
  }
  function removeFile(idx) {
    if (form.files.length <= 1) { setMsg('至少保留一个文件'); return; }
    const removed = form.files[idx];
    setForm((f) => {
      const files = f.files.filter((_, i) => i !== idx);
      const entry = f.entry === removed.name ? files[0].name : f.entry;
      return { ...f, files, entry };
    });
    setActiveFile(Math.max(0, idx - 1));
  }
  function renameActive(v) {
    const old = form.files[activeFile] ? form.files[activeFile].name : '';
    setForm((f) => ({ ...f, files: f.files.map((file, idx) => (idx === activeFile ? { ...file, name: v } : file)) }));
    if (form.entry === old) set('entry', v);
  }

  async function save() {
    let varsObj;
    try { varsObj = JSON.parse(form.vars || '{}'); } catch { setMsg('vars 不是合法 JSON'); return; }
    if (!form.name) { setMsg('请填写「脚本名称」再添加'); return; }
    if (!form.files.some((f) => f.content && f.content.trim())) { setMsg('至少需要一个文件有代码'); return; }
    const payload = { ...form, vars: varsObj };
    if (editing) {
      const r = await fetch('/api/scripts/' + editing.id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (r.ok) { setMsg('已更新'); setEditing(null); setForm(blankForm()); await load(); }
      else { const err = await r.json().catch(() => ({})); setMsg('更新失败：' + (err.error || ('HTTP ' + r.status))); }
    } else {
      const r = await fetch('/api/scripts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (r.ok) { setMsg('已添加'); setEditing(null); setForm(blankForm()); setActiveFile(0); await load(); }
      else { const err = await r.json().catch(() => ({})); setMsg('添加失败：' + (err.error || ('HTTP ' + r.status))); }
    }
  }

  async function run(id) {
    setMsg('运行中…');
    const r = await fetch('/api/scripts/' + id + '/run', { method: 'POST' });
    const d = await r.json();
    setConsoleOut(d.logs || (d.ok ? '（无输出）' : '(运行失败，无日志)'));
    setMsg(d.ok ? '运行成功' : '运行失败（见下方控制台）');
    await load();
  }

  async function del(id) {
    if (!confirm('确定删除该脚本？')) return;
    await fetch('/api/scripts/' + id, { method: 'DELETE' });
    await load();
  }

  async function viewLogs(id, name) {
    const d = await fetch('/api/scripts/' + id + '/logs').then((r) => r.json());
    setLogs({ id, name, data: d });
  }

  async function saveSettings() {
    const r = await fetch('/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings),
    });
    if (r.ok) setMsg('设置已保存');
  }

  function logout() {
    fetch('/api/logout', { method: 'POST' }).then(() => router.push('/login'));
  }

  const setS = (field, value) => setSettings((s) => ({ ...s, [field]: value }));
  const setSmtp = (field, value) => setSettings((s) => ({ ...s, smtp: { ...(s.smtp || {}), [field]: value } }));

  const af = form.files[activeFile] || form.files[0];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Vercel 任务面板</h2>
        <div>
          <button style={btn2} onClick={() => setShowSettings((v) => !v)}>设置</button>
          <button style={btn2} onClick={logout}>登出</button>
        </div>
      </div>
      {msg && <p style={{ color: '#7ee787' }}>{msg}</p>}

      {/* 添加 / 编辑表单 */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>{editing ? '编辑脚本：' + editing.name : '添加新脚本'}</h3>
        <input style={input} placeholder="脚本名称（如 掘金签到）" value={form.name} onChange={(e) => set('name', e.target.value)} />
        <div style={{ fontSize: 13, color: '#9aa4b2', margin: '4px 0' }}>脚本语言</div>
        <select style={input} value={form.language} onChange={(e) => set('language', e.target.value)}>
          <option value="js">JavaScript（Node.js，Vercel 原生支持，多文件可 import）</option>
          <option value="python">Python（仅标准库；Vercel 可能没有 python3）</option>
        </select>
        <input style={input} placeholder="cron 表达式（如 0 8 * * * 每天8点）" value={form.cron} onChange={(e) => set('cron', e.target.value)} />
        <div style={{ fontSize: 13, color: '#9aa4b2', margin: '4px 0' }}>
          变量（JSON，会作为环境变量注入脚本，如 {"{"}"COOKIE":"xxx"{"}"}）
        </div>
        <textarea style={ta} value={form.vars} onChange={(e) => set('vars', e.target.value)} />

        {/* 多文件标签页 */}
        <div style={{ fontSize: 13, color: '#9aa4b2', margin: '10px 0 4px' }}>脚本文件（支持多文件，可互相 require/import）</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {form.files.map((f, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: i === activeFile ? '#2d6cdf' : '#2b3140',
              color: i === activeFile ? '#fff' : '#e6e6e6',
              border: '1px solid #3a4252', borderRadius: 6, padding: '4px 8px', fontSize: 12,
            }}>
              <button onClick={() => setActiveFile(i)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>{f.name}</button>
              {form.files.length > 1 && <button onClick={() => removeFile(i)} style={{ background: 'transparent', border: 'none', color: '#ff9b9b', cursor: 'pointer', padding: 0 }}>×</button>}
            </span>
          ))}
          <button style={{ ...btn2, padding: '4px 8px', fontSize: 12 }} onClick={addFile}>＋ 新文件</button>
        </div>

        {/* 当前文件重命名 + 入口选择 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#9aa4b2' }}>当前文件：</span>
          <input style={{ ...input, width: 200 }} value={af ? af.name : ''} onChange={(e) => renameActive(e.target.value)} />
          <span style={{ fontSize: 12, color: '#9aa4b2' }}>入口文件：</span>
          <select style={{ ...input, width: 200 }} value={form.entry} onChange={(e) => set('entry', e.target.value)}>
            {form.files.map((f, i) => <option key={i} value={f.name}>{f.name}</option>)}
          </select>
        </div>

        {/* 代码编辑器（CodeMirror） */}
        <div style={{ marginTop: 8 }}>
          <CodeEditor value={af ? af.content : ''} language={form.language} onChange={setFileContent} height={300} />
        </div>

        {/* 运行控制台 */}
        {consoleOut !== null && (
          <div style={{ marginTop: 10, border: '1px solid #262b36', borderRadius: 6, background: '#0b0d12' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid #262b36' }}>
              <span style={{ fontSize: 12, color: '#9aa4b2' }}>运行输出（stdout / stderr）</span>
              <button style={{ ...btn2, padding: '2px 8px', fontSize: 12 }} onClick={() => setConsoleOut(null)}>清空</button>
            </div>
            <pre style={{ margin: 0, padding: 10, maxHeight: 240, overflow: 'auto', fontSize: 12, whiteSpace: 'pre-wrap', color: '#d6e0f0' }}>{consoleOut}</pre>
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <label style={{ marginRight: 16 }}><input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} /> 启用</label>
          <label style={{ marginRight: 16 }}><input type="checkbox" checked={form.notify} onChange={(e) => set('notify', e.target.checked)} /> 失败/成功通知</label>
          <label>重试次数 <input type="number" style={{ width: 60, marginLeft: 6 }} value={form.retries} onChange={(e) => set('retries', Number(e.target.value) || 0)} /></label>
        </div>
        <div style={{ marginTop: 10 }}>
          <button style={btn} onClick={save}>{editing ? '保存修改' : '添加脚本'}</button>
          {editing && <button style={btn} onClick={() => run(editing.id)}>▶ 运行（看输出）</button>}
          {editing && <button style={btn2} onClick={() => { setEditing(null); setForm(blankForm()); setActiveFile(0); }}>取消</button>}
        </div>
      </div>

      {/* 脚本列表 */}
      <h3>脚本列表（{scripts.length}）</h3>
      {loading ? <p>加载中…</p> : scripts.length === 0 ? <p style={{ color: '#9aa4b2' }}>还没有脚本，在上面添加一个吧。</p> : null}
      {scripts.map((s) => (
        <div key={s.id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <b>{s.name}</b> {!s.enabled && <span style={{ color: '#ff6b6b' }}>（已停用）</span>}
              <div style={{ fontSize: 12, color: '#9aa4b2' }}>cron: {s.cron || '（未设置）'} · 语言: {s.language || 'js'} · 文件: {(s.files || []).length || 1} · 上次: {s.lastRun ? new Date(s.lastRun).toLocaleString() : '从未'} · {s.lastStatus === 'success' ? '✅' : s.lastStatus === 'failed' ? '❌' : '—'}</div>
            </div>
            <div>
              <button style={btn} onClick={() => run(s.id)}>运行</button>
              <button style={btn2} onClick={() => editScript(s)}>编辑</button>
              <button style={btn2} onClick={() => viewLogs(s.id, s.name)}>日志</button>
              <button style={btn2} onClick={() => del(s.id)}>删除</button>
            </div>
          </div>
        </div>
      ))}

      {/* 设置面板 */}
      {showSettings && (
        <div style={card}>
          <h3 style={{ marginTop: 0 }}>全局通知设置</h3>
          <div style={{ fontSize: 13, color: '#9aa4b2', margin: '4px 0' }}>微信 Server 酱 SCK（sctapi.ftqq.com 获取）</div>
          <input style={input} placeholder="SERVER_KEY" value={settings.serverKey || ''} onChange={(e) => setS('serverKey', e.target.value)} />
          <div style={{ fontSize: 13, color: '#9aa4b2', margin: '4px 0' }}>邮件通知（SMTP）</div>
          <input style={input} placeholder="SMTP_HOST" value={settings.smtp?.host || ''} onChange={(e) => setSmtp('host', e.target.value)} />
          <input style={input} placeholder="SMTP_PORT（如 465）" value={settings.smtp?.port || ''} onChange={(e) => setSmtp('port', e.target.value)} />
          <input style={input} placeholder="SMTP_USER" value={settings.smtp?.user || ''} onChange={(e) => setSmtp('user', e.target.value)} />
          <input style={input} type="password" placeholder="SMTP_PASS" value={settings.smtp?.pass || ''} onChange={(e) => setSmtp('pass', e.target.value)} />
          <input style={input} placeholder="接收邮箱 NOTIFY_TO（逗号分隔）" value={settings.notifyTo || ''} onChange={(e) => setS('notifyTo', e.target.value)} />
          <button style={btn} onClick={saveSettings}>保存设置</button>
        </div>
      )}

      {/* 日志弹窗 */}
      {logs && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setLogs(null)}>
          <div style={{ background: '#0f1115', border: '1px solid #262b36', borderRadius: 8, padding: 16, maxWidth: 700, width: '100%', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ marginTop: 0 }}>{logs.name} · 执行日志</h3>
              <button style={btn2} onClick={() => setLogs(null)}>关闭</button>
            </div>
            {(logs.data || []).slice().reverse().map((l, i) => (
              <div key={i} style={{ borderTop: '1px solid #262b36', padding: '8px 0' }}>
                <div style={{ fontSize: 12, color: '#9aa4b2' }}>{new Date(l.time).toLocaleString()} · {l.status === 'success' ? '✅' : '❌'} {l.trigger ? '(' + l.trigger + ')' : ''}</div>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: '4px 0' }}>{l.logs}</pre>
              </div>
            ))}
            {(!logs.data || logs.data.length === 0) && <p style={{ color: '#9aa4b2' }}>暂无日志</p>}
          </div>
        </div>
      )}
    </div>
  );
}
