'use client';

import { useState } from 'react';
import { navigatePendingWindow, openPendingWindow } from '../../_components/open-new-window';

export function TutorialActions({ tutorialId, hasTopics, hasScripts }: { tutorialId: string; hasTopics: boolean; hasScripts: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function run(action: 'parse' | 'process') {
    const nextWindow = openPendingWindow();
    const key = action;
    setBusy(key);
    setMessage(action === 'parse' ? '正在解析教程...' : '正在执行完整流程...');
    try {
      const response = await fetch(action === 'parse' ? `/api/tutorials/${tutorialId}/parse` : `/api/tutorials/${tutorialId}/process`, {
        method: 'POST'
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || '操作失败');
      }
      setMessage(action === 'parse' ? '教程解析完成，已在新窗口打开最新详情。' : '教程全流程处理完成，已在新窗口打开脚本工作台。');
      navigatePendingWindow(nextWindow, action === 'parse' ? `/tutorials/${tutorialId}` : '/scripts');
    } catch (error) {
      nextWindow?.close();
      setMessage(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => run('parse')} disabled={busy !== null} style={buttonStyle(busy === 'parse')}>{busy === 'parse' ? '解析中...' : '重新解析教程'}</button>
        <button onClick={() => run('process')} disabled={busy !== null} style={primaryButtonStyle(busy === 'process')}>{busy === 'process' ? '处理中...' : hasScripts ? '重新跑完整流程' : '一键生成选题和脚本'}</button>
      </div>
      <div style={{ color: '#cbd5e1', lineHeight: 1.7 }}>
        当前状态：{hasScripts ? '已经有脚本，可直接继续推进视频。' : hasTopics ? '已有选题，适合继续补齐脚本。' : '还没有选题和脚本，建议先跑完整流程。'}
      </div>
      {message ? <div style={{ color: '#93c5fd', lineHeight: 1.7 }}>{message}</div> : null}
    </div>
  );
}

function buttonStyle(isBusy: boolean) {
  return {
    border: '1px solid rgba(148,163,184,0.24)',
    borderRadius: 14,
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.04)',
    color: '#e5ecf7',
    fontWeight: 700,
    cursor: isBusy ? 'progress' : 'pointer'
  } as const;
}

function primaryButtonStyle(isBusy: boolean) {
  return {
    border: 'none',
    borderRadius: 14,
    padding: '12px 16px',
    background: isBusy ? '#0f766e' : 'linear-gradient(135deg, #67e8f9, #14b8a6)',
    color: '#061018',
    fontWeight: 800,
    cursor: isBusy ? 'progress' : 'pointer'
  } as const;
}
