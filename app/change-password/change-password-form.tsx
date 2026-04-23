'use client';

import { useState } from 'react';

export function ChangePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setMessage('');
    if (!password || !confirmPassword) return setMessage('请填写完整');
    if (password !== confirmPassword) return setMessage('两次输入的密码不一致');

    setBusy(true);
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const payload = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(payload.error || '修改失败');
    window.location.href = '/login';
  }

  return (
    <div style={{ width: '100%', maxWidth: 460, borderRadius: 28, padding: 28, background: 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(6,10,18,0.96) 100%)', border: '1px solid rgba(148,163,184,0.14)', display: 'grid', gap: 16 }}>
      <div>
        <div style={{ color: '#818cf8', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Security Update</div>
        <h1 style={{ margin: '10px 0 0', fontSize: 36 }}>先修改你的密码</h1>
        <p style={{ margin: '12px 0 0', color: '#cbd5e1', lineHeight: 1.8 }}>这是首次登录或管理员刚重置过密码。为了长期使用安全，你需要先设置新的个人密码，然后再重新登录。</p>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 8 }}>
          <span style={{ color: '#94a3b8', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>新密码</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 8 }}>
          <span style={{ color: '#94a3b8', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>确认密码</span>
          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} style={inputStyle} />
        </label>
        <button onClick={submit} disabled={busy} style={buttonStyle}>{busy ? '提交中…' : '更新密码并重新登录'}</button>
        {message ? <div style={{ color: '#fda4af' }}>{message}</div> : null}
      </div>
    </div>
  );
}

const inputStyle = {
  borderRadius: 14,
  border: '1px solid rgba(148,163,184,0.18)',
  background: 'rgba(2,6,23,0.56)',
  color: '#f8fafc',
  padding: '12px 14px',
  outline: 'none'
} as const;

const buttonStyle = {
  border: 'none',
  borderRadius: 14,
  padding: '12px 14px',
  background: 'linear-gradient(135deg, #67e8f9, #06b6d4)',
  color: '#0f172a',
  fontWeight: 800,
  cursor: 'pointer'
} as const;
