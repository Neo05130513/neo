import Link from 'next/link';
import { newWindowLinkProps } from '../../_components/studio-ui';
import { ProjectStatusBadge } from '../project-status-badge';
import { VideoOpsStatus } from '@/lib/types';

export const videoPanelStyle = {
  background: 'rgba(15,23,42,0.82)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 24
} as const;

export function Queue({ title, note, empty, children }: { title: string; note: string; empty: string; children: React.ReactNode }) {
  const ok = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section style={{ ...videoPanelStyle, padding: 22, display: 'grid', gap: 14, alignContent: 'start' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24 }}>{title}</h2>
        <p style={{ margin: '8px 0 0', color: '#94a3b8', lineHeight: 1.7 }}>{note}</p>
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        {ok ? children : <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.8 }}>{empty}</p>}
      </div>
    </section>
  );
}

export function SingleViewPanel({ title, note, empty, children }: { title: string; note: string; empty: string; children: React.ReactNode }) {
  const ok = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section style={{ ...videoPanelStyle, padding: 22, display: 'grid', gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24 }}>{title}</h2>
        <p style={{ margin: '8px 0 0', color: '#94a3b8', lineHeight: 1.7 }}>{note}</p>
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        {ok ? children : <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.8 }}>{empty}</p>}
      </div>
    </section>
  );
}

export function QueueCard({
  project,
  tutorialTitle,
  assetCount,
  review,
  scriptId
}: {
  project: { id: string; title: string; status: 'draft' | 'storyboarded' | 'rendering' | 'completed' | 'failed'; updatedAt: string; lastError?: string | null };
  tutorialTitle?: string;
  assetCount: number;
  review?: { issueTags?: string[]; recommendations?: string[]; notes?: string };
  scriptId?: string;
}) {
  return (
    <article style={{ padding: 18, borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <ProjectStatusBadge status={project.status} />
          <strong>{project.title}</strong>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href={`/videos/${project.id}`} {...newWindowLinkProps} style={{ color: '#67e8f9', textDecoration: 'none', fontWeight: 700 }}>打开详情 →</Link>
          {scriptId ? <Link href={`/scripts/${scriptId}`} {...newWindowLinkProps} style={{ color: '#c4b5fd', textDecoration: 'none', fontWeight: 700 }}>去返工脚本 →</Link> : null}
        </div>
      </div>
      <div style={{ color: '#93c5fd' }}>教程：{tutorialTitle || '未知教程'}</div>
      <div style={{ color: '#94a3b8' }}>更新时间：{formatDate(project.updatedAt)} · 资产 {assetCount} 个</div>
      {project.lastError ? <div style={{ color: '#fecaca', lineHeight: 1.7 }}>失败原因：{project.lastError}</div> : null}
      {review?.issueTags?.length ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {review.issueTags.slice(0, 4).map((tag) => <span key={tag} style={{ padding: '6px 10px', borderRadius: 999, background: 'rgba(250,204,21,0.12)', color: '#fde68a', fontSize: 12 }}>{formatIssueTag(tag)}</span>)}
        </div>
      ) : null}
      {review?.recommendations?.length ? (
        <div style={{ color: '#e2e8f0', lineHeight: 1.7 }}>建议：{review.recommendations.slice(0, 2).join('；')}</div>
      ) : review?.notes ? (
        <div style={{ color: '#cbd5e1', lineHeight: 1.7 }}>结论：{review.notes}</div>
      ) : null}
    </article>
  );
}

export function QualityQueueCard({ title, count, desc, href, accent }: { title: string; count: number; desc: string; href: string; accent: string }) {
  return (
    <Link href={href} {...newWindowLinkProps} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{ ...videoPanelStyle, padding: 18, display: 'grid', gap: 8, border: `1px solid ${accent}33` }}>
        <div style={{ color: accent, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{title}</div>
        <div style={{ color: accent, fontSize: 28, fontWeight: 800, lineHeight: 1.2 }}>{count}</div>
        <div style={{ color: '#cbd5e1', lineHeight: 1.7 }}>{desc}</div>
        <div style={{ color: accent, fontWeight: 700 }}>进入清单 →</div>
      </div>
    </Link>
  );
}

export function BulkOpsActionBar({ title, actionLabel, projectIds, opsStatus, emptyText }: { title: string; actionLabel: string; projectIds: string[]; opsStatus: VideoOpsStatus; emptyText: string }) {
  return (
    <form action={async () => {
      'use server';
      const { updateVideoProjectsOpsStatus } = await import('@/lib/videos');
      await updateVideoProjectsOpsStatus(projectIds, opsStatus);
    }} style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.14)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <strong>{title}</strong>
          <div style={{ color: '#94a3b8', marginTop: 6 }}>{projectIds.length ? `本次会处理 ${projectIds.length} 个项目` : emptyText}</div>
        </div>
        <button type="submit" disabled={projectIds.length === 0} style={{ border: 'none', borderRadius: 12, padding: '10px 14px', background: projectIds.length ? 'linear-gradient(135deg, #67e8f9, #22d3ee)' : 'rgba(148,163,184,0.18)', color: projectIds.length ? '#04111d' : '#94a3b8', fontWeight: 800, cursor: projectIds.length ? 'pointer' : 'not-allowed' }}>{actionLabel}</button>
      </div>
    </form>
  );
}

export function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 16, padding: 14, background: 'rgba(6,10,21,0.82)', border: '1px solid rgba(148,163,184,0.14)', display: 'grid', gap: 6 }}>
      <span style={{ color: '#8491c7', fontSize: 12 }}>{label}</span>
      <span style={{ lineHeight: 1.6 }}>{value}</span>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function formatIssueTag(tag: string) {
  const labels: Record<string, string> = {
    'missing-final-video': '缺少最终成片',
    'image-coverage-gap': '镜头画面覆盖不足',
    'subtitle-coverage-gap': '字幕覆盖不足',
    'scene-density-low': '镜头信息密度偏低',
    'visual-clarity-risk': '视觉清晰度风险',
    'subtitle-readability-risk': '字幕可读性风险',
    'rhythm-pacing-risk': '节奏风险',
    'preset-needs-human-check': '预设需人工复核'
  };
  return labels[tag] || tag;
}
