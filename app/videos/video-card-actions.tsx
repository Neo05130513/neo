'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { secondaryButtonStyle } from '../_components/studio-ui';

export function VideoCardActions({ projectId, canStop, canRender }: { projectId: string; canStop: boolean; canRender: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  async function stopProject() {
    setBusy('stop');
    setMessage('正在停止生成...');
    try {
      const response = await fetch(`/api/videos/${projectId}/render-job/cancel`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '停止失败');
      setMessage('已停止生成。');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '停止失败');
    } finally {
      setBusy('');
    }
  }

  async function deleteProject() {
    if (!window.confirm('确定删除这个视频项目吗？相关分镜、素材记录和任务记录会一起删除。')) return;
    setBusy('delete');
    setMessage('正在删除...');
    try {
      const response = await fetch(`/api/videos/${projectId}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '删除失败');
      setMessage('已删除。');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败');
    } finally {
      setBusy('');
    }
  }

  async function renderProject() {
    setBusy('render');
    setMessage('正在提交生成任务...');
    try {
      const response = await fetch(`/api/videos/${projectId}/render`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '提交生成失败');
      setMessage('已提交生成任务。');
      window.dispatchEvent(new CustomEvent('video-render-started', { detail: { projectId } }));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '提交生成失败');
    } finally {
      setBusy('');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {canRender ? (
          <button type="button" onClick={renderProject} disabled={Boolean(busy)} style={{ ...secondaryButtonStyle, color: '#bae6fd', borderColor: '#155e75' }}>
            {busy === 'render' ? '提交中...' : '开始生成'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={stopProject}
          disabled={Boolean(busy) || !canStop}
          title={canStop ? '停止当前生成任务' : '当前没有正在生成的任务'}
          style={{
            ...secondaryButtonStyle,
            color: canStop ? '#fde68a' : '#64748b',
            borderColor: canStop ? '#854d0e' : '#334155',
            cursor: Boolean(busy) ? 'progress' : canStop ? 'pointer' : 'not-allowed',
            opacity: canStop ? 1 : 0.72
          }}
        >
          {busy === 'stop' ? '停止中...' : '停止生成'}
        </button>
        <button type="button" onClick={deleteProject} disabled={Boolean(busy)} style={{ ...secondaryButtonStyle, color: '#fecaca', borderColor: '#7f1d1d' }}>
          {busy === 'delete' ? '删除中...' : '删除'}
        </button>
      </div>
      {message ? <span style={{ color: '#93c5fd', fontSize: 12, lineHeight: 1.5 }}>{message}</span> : null}
    </div>
  );
}
