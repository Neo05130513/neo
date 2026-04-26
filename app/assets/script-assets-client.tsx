'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EmptyGuide, StatusBadge } from '../_components/studio-ui';
import type { Script, VideoProject } from '@/lib/types';

export function ScriptAssetsClient({ initialScripts, projects }: { initialScripts: Script[]; projects: VideoProject[] }) {
  const [scripts, setScripts] = useState(initialScripts);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const pendingScripts = useMemo(() => scripts.filter((script) => !projects.some((item) => item.scriptId === script.id)), [projects, scripts]);
  const pendingIdSet = useMemo(() => new Set(pendingScripts.map((script) => script.id)), [pendingScripts]);
  const selectedPendingIds = selectedIds.filter((id) => pendingIdSet.has(id));
  const allPendingSelected = pendingScripts.length > 0 && selectedPendingIds.length === pendingScripts.length;

  function toggleSelected(scriptId: string) {
    setSelectedIds((current) => current.includes(scriptId) ? current.filter((id) => id !== scriptId) : [...current, scriptId]);
  }

  function toggleAllPending() {
    setSelectedIds((current) => {
      const currentSet = new Set(current);
      if (allPendingSelected) return current.filter((id) => !pendingIdSet.has(id));
      pendingScripts.forEach((script) => currentSet.add(script.id));
      return Array.from(currentSet);
    });
  }

  async function deleteOne(scriptId: string, title: string) {
    if (!window.confirm(`确定删除脚本《${title}》吗？删除后无法恢复。`)) return;
    setBusyKey(`delete:${scriptId}`);
    setMessage('正在删除脚本...');
    try {
      const response = await fetch(`/api/scripts/${scriptId}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '删除脚本失败');
      setScripts((current) => current.filter((item) => item.id !== scriptId));
      setSelectedIds((current) => current.filter((id) => id !== scriptId));
      setMessage(`已删除脚本：${title}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除脚本失败');
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteSelected() {
    if (!selectedPendingIds.length) {
      setMessage('请先勾选至少一条未生成视频的脚本。');
      return;
    }
    if (!window.confirm(`确定批量删除 ${selectedPendingIds.length} 条脚本吗？删除后无法恢复。`)) return;
    setBusyKey('batch-delete');
    setMessage('正在批量删除脚本...');
    try {
      const response = await fetch('/api/scripts/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptIds: selectedPendingIds })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '批量删除脚本失败');
      const deletedIdSet = new Set<string>((payload.deleted || []).map((item: { id: string }) => item.id));
      setScripts((current) => current.filter((item) => !deletedIdSet.has(item.id)));
      setSelectedIds((current) => current.filter((id) => !deletedIdSet.has(id)));
      setMessage(`已批量删除 ${payload.count || deletedIdSet.size} 条脚本。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '批量删除脚本失败');
    } finally {
      setBusyKey(null);
    }
  }

  if (!scripts.length) return <EmptyGuide title="还没有脚本" text="导入文档并生成视频后，系统会自动沉淀脚本。" />;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={toggleAllPending} disabled={busyKey !== null || !pendingScripts.length} style={toolbarButtonStyle(false)}>
            {allPendingSelected ? '取消全选未生成' : '全选未生成'}
          </button>
          <button onClick={() => setSelectedIds((current) => current.filter((id) => !pendingIdSet.has(id)))} disabled={busyKey !== null || !selectedPendingIds.length} style={toolbarButtonStyle(false)}>
            清空选择
          </button>
          <button onClick={deleteSelected} disabled={busyKey !== null || !selectedPendingIds.length} style={toolbarButtonStyle(true)}>
            {busyKey === 'batch-delete' ? '删除中...' : `批量删除 (${selectedPendingIds.length})`}
          </button>
        </div>
        <span style={{ color: '#94a3b8', lineHeight: 1.6 }}>只允许删除未生成视频的脚本，避免误删已推进项目。</span>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {scripts.slice(0, 80).map((script) => {
          const project = projects.find((item) => item.scriptId === script.id);
          const deletable = !project;
          const deleting = busyKey === `delete:${script.id}`;
          return (
            <div key={script.id} style={{ borderRadius: 10, border: '1px solid #243042', background: '#111823', padding: 14, display: 'grid', gridTemplateColumns: '26px minmax(0, 1fr) auto', gap: 14, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={selectedIds.includes(script.id)}
                onChange={() => toggleSelected(script.id)}
                disabled={busyKey !== null || !deletable}
                style={{ width: 18, height: 18 }}
              />
              <Link href={`/scripts/${script.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'grid', gap: 5, minWidth: 0 }}>
                <strong>{script.title}</strong>
                <span style={{ color: '#94a3b8' }}>版本 v{script.version || 1} · {script.duration}</span>
              </Link>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <StatusBadge text={project ? '已生成视频' : '未生成视频'} tone={project ? 'success' : 'warning'} />
                {deletable ? (
                  <button onClick={() => void deleteOne(script.id, script.title)} disabled={busyKey !== null} style={toolbarButtonStyle(true)}>
                    {deleting ? '删除中...' : '删除'}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {message ? <div style={{ color: '#93c5fd', lineHeight: 1.7 }}>{message}</div> : null}
    </div>
  );
}

function toolbarButtonStyle(danger: boolean) {
  return {
    border: `1px solid ${danger ? 'rgba(248,113,113,0.28)' : 'rgba(148,163,184,0.24)'}`,
    borderRadius: 12,
    padding: '10px 14px',
    background: danger ? 'rgba(127,29,29,0.24)' : 'rgba(255,255,255,0.04)',
    color: danger ? '#fecaca' : '#e5ecf7',
    fontWeight: 800,
    cursor: 'pointer'
  } as const;
}
