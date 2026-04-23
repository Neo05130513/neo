'use client';

import { useEffect, useState } from 'react';
import { navigatePendingWindow, openPendingWindow } from '../../_components/open-new-window';

export function VideoProjectActions({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [jobStatus, setJobStatus] = useState<string>('');
  const [pendingRenderWindow, setPendingRenderWindow] = useState<Window | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const response = await fetch(`/api/videos/${projectId}/render-job`, { cache: 'no-store' });
        const payload = await response.json();
        const job = payload.job as { status?: string; error?: string; outputPath?: string } | null;
        if (cancelled || !job?.status) return;
        setJobStatus(job.status);
        if (job.status === 'queued') setMessage('渲染任务已进入队列，等待执行...');
        if (job.status === 'running') setMessage('渲染任务执行中，请稍等...');
        if (job.status === 'completed') setMessage(`项目《${projectTitle}》渲染完成，已在新窗口打开最新详情。`);
        if (job.status === 'failed') setMessage(job.error || '渲染任务失败');
        if (job.status === 'cancelled') setMessage(job.error || '已停止生成。');
        if (job.status === 'queued' || job.status === 'running') {
          timer = setTimeout(poll, 2500);
        } else if (job.status === 'completed' && !cancelled && pendingRenderWindow) {
          navigatePendingWindow(pendingRenderWindow, `/videos/${projectId}`);
          setPendingRenderWindow(null);
        }
      } catch {
        if (!cancelled) timer = setTimeout(poll, 4000);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pendingRenderWindow, projectId, projectTitle]);

  async function regenerateStoryboard() {
    const nextWindow = openPendingWindow();
    setBusy('storyboard');
    setMessage('正在重新生成分镜...');
    try {
      const response = await fetch(`/api/videos/${projectId}/storyboard`, {
        method: 'POST'
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || '重新生成分镜失败');
      }
      setMessage(`项目《${projectTitle}》分镜已更新，已在新窗口打开最新详情。`);
      navigatePendingWindow(nextWindow, `/videos/${projectId}`);
    } catch (error) {
      nextWindow?.close();
      setMessage(error instanceof Error ? error.message : '重新生成分镜失败');
    } finally {
      setBusy(null);
    }
  }

  async function renderProject() {
    const nextWindow = openPendingWindow();
    setBusy('render');
    setMessage('正在提交渲染任务...');
    try {
      const response = await fetch(`/api/videos/${projectId}/render`, {
        method: 'POST'
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || '提交渲染任务失败');
      }
      setJobStatus(payload.job?.status || 'queued');
      setPendingRenderWindow(nextWindow);
      setMessage('渲染任务已创建，系统会异步执行。');
    } catch (error) {
      nextWindow?.close();
      setMessage(error instanceof Error ? error.message : '渲染视频失败');
    } finally {
      setBusy(null);
    }
  }

  async function stopProject() {
    setBusy('stop');
    setMessage('正在停止生成...');
    try {
      const response = await fetch(`/api/videos/${projectId}/render-job/cancel`, {
        method: 'POST'
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || '停止生成失败');
      }
      setJobStatus('cancelled');
      setPendingRenderWindow(null);
      setMessage('已停止生成。后续可以重新渲染项目。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '停止生成失败');
    } finally {
      setBusy(null);
    }
  }

  async function deleteProject() {
    if (!window.confirm('确定删除这个视频项目吗？相关分镜、素材记录和任务记录会一起删除。')) return;
    setBusy('delete');
    setMessage('正在删除视频项目...');
    try {
      const response = await fetch(`/api/videos/${projectId}`, {
        method: 'DELETE'
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || '删除视频失败');
      }
      window.location.href = '/videos';
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除视频失败');
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={regenerateStoryboard} disabled={busy !== null} style={secondaryButtonStyle(busy === 'storyboard')}>
          {busy === 'storyboard' ? '生成中...' : '重新生成分镜'}
        </button>
        <button onClick={renderProject} disabled={busy !== null || jobStatus === 'queued' || jobStatus === 'running'} style={primaryButtonStyle(busy === 'render' || jobStatus === 'queued' || jobStatus === 'running')}>
          {busy === 'render' ? '提交中...' : jobStatus === 'queued' ? '排队中...' : jobStatus === 'running' ? '渲染中...' : '重新渲染项目'}
        </button>
        {jobStatus === 'queued' || jobStatus === 'running' ? (
          <button onClick={stopProject} disabled={busy !== null} style={dangerButtonStyle(busy === 'stop', 'warning')}>
            {busy === 'stop' ? '停止中...' : '停止生成'}
          </button>
        ) : null}
        <button onClick={deleteProject} disabled={busy !== null} style={dangerButtonStyle(busy === 'delete', 'danger')}>
          {busy === 'delete' ? '删除中...' : '删除视频'}
        </button>
      </div>
      {message ? <div style={{ color: '#93c5fd', lineHeight: 1.7 }}>{message}</div> : null}
    </div>
  );
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

function secondaryButtonStyle(isBusy: boolean) {
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

function dangerButtonStyle(isBusy: boolean, tone: 'warning' | 'danger') {
  return {
    border: `1px solid ${tone === 'warning' ? '#854d0e' : '#7f1d1d'}`,
    borderRadius: 14,
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.04)',
    color: tone === 'warning' ? '#fde68a' : '#fecaca',
    fontWeight: 800,
    cursor: isBusy ? 'progress' : 'pointer'
  } as const;
}
