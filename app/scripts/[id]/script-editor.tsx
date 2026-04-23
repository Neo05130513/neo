'use client';

import { useState } from 'react';
import { navigatePendingWindow, openPendingWindow } from '../../_components/open-new-window';

export function ScriptEditor({
  scriptId,
  initialTitle,
  initialHook,
  initialBody,
  initialCta,
  initialStyle
}: {
  scriptId: string;
  initialTitle: string;
  initialHook: string;
  initialBody: string;
  initialCta: string;
  initialStyle: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [hook, setHook] = useState(initialHook);
  const [body, setBody] = useState(initialBody);
  const [cta, setCta] = useState(initialCta);
  const [style, setStyle] = useState(initialStyle);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function save() {
    const nextWindow = openPendingWindow();
    setBusy(true);
    setMessage('正在保存脚本修改...');
    try {
      const response = await fetch(`/api/scripts/${scriptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, hook, body, cta, style })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || '保存脚本失败');
      }
      setMessage('脚本已保存，已在新窗口打开最新脚本。');
      navigatePendingWindow(nextWindow, `/scripts/${scriptId}`);
    } catch (error) {
      nextWindow?.close();
      setMessage(error instanceof Error ? error.message : '保存脚本失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Field label="标题">
        <input value={title} onChange={(event) => setTitle(event.target.value)} style={inputStyle} />
      </Field>
      <Field label="Hook">
        <textarea value={hook} onChange={(event) => setHook(event.target.value)} style={{ ...textareaStyle, minHeight: 110 }} />
      </Field>
      <Field label="Body">
        <textarea value={body} onChange={(event) => setBody(event.target.value)} style={{ ...textareaStyle, minHeight: 220 }} />
      </Field>
      <Field label="CTA">
        <textarea value={cta} onChange={(event) => setCta(event.target.value)} style={{ ...textareaStyle, minHeight: 110 }} />
      </Field>
      <Field label="风格">
        <input value={style} onChange={(event) => setStyle(event.target.value)} style={inputStyle} />
      </Field>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={save} disabled={busy} style={saveButtonStyle(busy)}>{busy ? '保存中...' : '保存脚本修改'}</button>
        <span style={{ color: '#94a3b8', lineHeight: 1.7 }}>建议：先复制新版本，再编辑，避免覆盖原始文案。</span>
      </div>
      {message ? <div style={{ color: '#93c5fd', lineHeight: 1.7 }}>{message}</div> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: 8 }}><span style={{ color: '#94a3b8', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>{children}</label>;
}

const inputStyle = {
  borderRadius: 14,
  border: '1px solid rgba(148,163,184,0.18)',
  background: 'rgba(2,6,23,0.56)',
  color: '#f8fafc',
  padding: '12px 14px',
  outline: 'none'
} as const;

const textareaStyle = {
  borderRadius: 14,
  border: '1px solid rgba(148,163,184,0.18)',
  background: 'rgba(2,6,23,0.56)',
  color: '#f8fafc',
  padding: '12px 14px',
  outline: 'none',
  resize: 'vertical' as const,
  lineHeight: 1.8
};

function saveButtonStyle(busy: boolean) {
  return {
    border: 'none',
    borderRadius: 14,
    padding: '10px 14px',
    background: busy ? '#0891b2' : 'linear-gradient(135deg, #67e8f9, #06b6d4)',
    color: '#0f172a',
    fontWeight: 800,
    cursor: busy ? 'progress' : 'pointer'
  } as const;
}
