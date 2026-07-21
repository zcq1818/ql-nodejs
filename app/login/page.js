'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();
  async function submit(e) {
    e.preventDefault();
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (r.ok) router.push('/dashboard');
    else setErr('密码错误');
  }
  return (
    <div style={{ maxWidth: 360, margin: '15vh auto', padding: 24 }}>
      <h2>任务面板登录</h2>
      <form onSubmit={submit}>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="访问密码"
          style={{ width: '100%', padding: 10, margin: '8px 0', boxSizing: 'border-box', background: '#171a21', color: '#fff', border: '1px solid #262b36', borderRadius: 6 }}
        />
        <button type="submit" style={{ width: '100%', padding: 10, background: '#2d6cdf', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          登录
        </button>
      </form>
      {err && <p style={{ color: '#ff6b6b' }}>{err}</p>}
    </div>
  );
}
