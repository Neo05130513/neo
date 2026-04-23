'use client';

import { useState } from 'react';
import { navigatePendingWindow, openPendingWindow } from '../_components/open-new-window';

export function TopicActions({ topicId, tutorialId, hasScripts }: { topicId: string; tutorialId: string; hasScripts: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function generateScripts() {
    const nextWindow = openPendingWindow();
    setBusy('scripts');
    setMessage('正在为该选题生成脚本...');
    try {
      const response = await fetch('/api/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicId })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || '生成脚本失败');
      }
      setMessage('脚本生成完成，已在新窗口打开脚本工作台。');
      navigatePendingWindow(nextWindow, '/scripts');
    } catch (error) {
      nextWindow?.close();
      setMessage(error instanceof Error ? error.message : '生成脚本失败');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={generateScripts} disabled={busy !== null} style={primaryButtonStyle(busy === 'scripts')}>
          {busy === 'scripts' ? '生成中...' : hasScripts ? '重新生成该选题脚本' : '为该选题生成脚本'}
        </button>
        <a href={`/tutorials/${tutorialId}`} target="_blank" rel="noreferrer" style={linkStyle('#93c5fd')}>查看教程详情 →</a>
        <a href="/videos" target="_blank" rel="noreferrer" style={linkStyle('#67e8f9')}>去视频工厂 →</a>
      </div>
      {message ? <div style={{ color: '#93c5fd', lineHeight: 1.7 }}>{message}</div> : null}
    </div>
  );
}

function primaryButtonStyle(isBusy: boolean) {
  return {
    border: 'none',
    borderRadius: 14,
    padding: '10px 14px',
    background: isBusy ? '#7c3aed' : 'linear-gradient(135deg, #c4b5fd, #8b5cf6)',
    color: '#0f172a',
    fontWeight: 800,
    cursor: isBusy ? 'progress' : 'pointer'
  } as const;
}

function linkStyle(color: string) {
  return {
    textDecoration: 'none',
    color,
    fontWeight: 700,
    padding: '10px 0'
  } as const;
}
