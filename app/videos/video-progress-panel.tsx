'use client';

import { useEffect, useState } from 'react';
import type { VideoProgressSnapshot } from '@/lib/video-progress';

export function VideoProgressPanel({ projectId, initial }: { projectId: string; initial: VideoProgressSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);

  useEffect(() => {
    setSnapshot(initial);
  }, [initial, projectId]);

  useEffect(() => {
    function handleRenderStarted(event: Event) {
      const detail = (event as CustomEvent<{ projectId?: string }>).detail;
      if (detail?.projectId !== projectId) return;
      setSnapshot({
        label: '排队等待',
        detail: '任务已提交，正在等待并发空位或设备资源。此时可以停止生成。',
        progress: 12,
        canStop: true
      });
    }

    window.addEventListener('video-render-started', handleRenderStarted);
    return () => window.removeEventListener('video-render-started', handleRenderStarted);
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const response = await fetch(`/api/videos/${projectId}/progress`, { cache: 'no-store' });
        const payload = await response.json();
        if (!cancelled && response.ok && payload.progress) {
          setSnapshot(payload.progress);
        }
      } catch {
      } finally {
        if (!cancelled && snapshot.progress < 100) {
          timer = setTimeout(poll, 2500);
        }
      }
    }

    timer = setTimeout(poll, 1200);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [projectId, snapshot.progress]);

  return (
    <div style={{ display: 'grid', gap: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: '#cbd5e1', fontSize: 13 }}>
        <strong>{snapshot.label}</strong>
        <span>{snapshot.progress}%</span>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: '#0f172a', overflow: 'hidden', border: '1px solid #243042' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, snapshot.progress))}%`, height: '100%', borderRadius: 999, background: snapshot.progress >= 100 ? '#34d399' : '#38bdf8', transition: 'width 260ms ease' }} />
      </div>
      <span style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>{snapshot.detail}</span>
    </div>
  );
}
