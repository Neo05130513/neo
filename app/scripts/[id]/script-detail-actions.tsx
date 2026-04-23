'use client';

import Link from 'next/link';
import { useState } from 'react';
import { navigatePendingWindow, openPendingWindow } from '../../_components/open-new-window';
import { linkButtonStyle, newWindowLinkProps, primaryButtonStyle, secondaryButtonStyle } from '../../_components/studio-ui';

export function ScriptDetailActions({ scriptId, projectIds }: { scriptId: string; projectIds: string[] }) {
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  async function createProject() {
    const nextWindow = openPendingWindow();
    setBusy('create');
    setMessage('已确认当前镜头拆解，正在创建视频...');
    try {
      const response = await fetch('/api/videos/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '创建视频失败');
      navigatePendingWindow(nextWindow, `/videos/${payload.project.id}`);
    } catch (error) {
      nextWindow?.close();
      setMessage(error instanceof Error ? error.message : '创建视频失败');
    } finally {
      setBusy('');
    }
  }

  async function duplicateScript() {
    const nextWindow = openPendingWindow();
    setBusy('duplicate');
    setMessage('正在复制脚本...');
    try {
      const response = await fetch('/api/scripts/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '复制脚本失败');
      navigatePendingWindow(nextWindow, `/scripts/${payload.script.id}`);
    } catch (error) {
      nextWindow?.close();
      setMessage(error instanceof Error ? error.message : '复制脚本失败');
    } finally {
      setBusy('');
    }
  }

  async function rebuildProject(projectId: string) {
    const nextWindow = openPendingWindow();
    setBusy(`rebuild:${projectId}`);
    setMessage('正在按当前脚本重建视频...');
    try {
      const response = await fetch(`/api/videos/${projectId}/rebuild-from-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '重建视频失败');
      navigatePendingWindow(nextWindow, `/videos/${payload.project.id}`);
    } catch (error) {
      nextWindow?.close();
      setMessage(error instanceof Error ? error.message : '重建视频失败');
    } finally {
      setBusy('');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <button type="button" onClick={createProject} disabled={Boolean(busy)} style={primaryButtonStyle}>
        {busy === 'create' ? '创建中...' : '确认镜头并生成视频'}
      </button>
      <button type="button" onClick={duplicateScript} disabled={Boolean(busy)} style={secondaryButtonStyle}>
        {busy === 'duplicate' ? '复制中...' : '复制一份再修改'}
      </button>
      {projectIds.slice(0, 3).map((projectId) => (
        <button key={projectId} type="button" onClick={() => rebuildProject(projectId)} disabled={Boolean(busy)} style={secondaryButtonStyle}>
          {busy === `rebuild:${projectId}` ? '重建中...' : `更新已有视频 ${projectId.slice(-4)}`}
        </button>
      ))}
      <Link href={`/api/scripts/${scriptId}/export`} {...newWindowLinkProps} style={linkButtonStyle('secondary')}>导出 TXT</Link>
      {message ? <div style={{ color: '#93c5fd', lineHeight: 1.6 }}>{message}</div> : null}
    </div>
  );
}
