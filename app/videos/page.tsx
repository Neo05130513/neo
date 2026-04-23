export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { StudioShell } from '../_components/studio-shell';
import { EmptyGuide, linkButtonStyle, MetricTile, newWindowLinkProps, Panel, SectionTitle, StatusBadge, subtlePanelStyle } from '../_components/studio-ui';
import { getRenderJobs, getTutorials, getVideoAssets, getVideoProjects, getVideoScenes } from '@/lib/queries';
import type { Tutorial, VideoProjectStatus } from '@/lib/types';
import { getVideoProgressSnapshot } from '@/lib/video-progress';
import { VideoCardActions } from './video-card-actions';
import { VideoProgressPanel } from './video-progress-panel';

type DayFilter = '3' | '7' | '30' | 'all';

export default async function VideoLibraryPage({ searchParams }: { searchParams?: { days?: DayFilter } }) {
  const [projects, assets, jobs, tutorials, scenes] = await Promise.all([
    getVideoProjects(),
    getVideoAssets(),
    getRenderJobs().catch(() => []),
    getTutorials(),
    getVideoScenes()
  ]);

  const activeDays: DayFilter = searchParams?.days === '7' || searchParams?.days === '30' || searchParams?.days === 'all' ? searchParams.days : '3';
  const tutorialById = new Map(tutorials.map((tutorial) => [tutorial.id, tutorial]));
  const latestJobByProject = new Map<string, (typeof jobs)[number]>();
  for (const job of jobs) {
    const current = latestJobByProject.get(job.projectId);
    if (!current || Number(new Date(job.updatedAt)) > Number(new Date(current.updatedAt))) {
      latestJobByProject.set(job.projectId, job);
    }
  }
  const cutoff = activeDays === 'all' ? null : Date.now() - Number(activeDays) * 24 * 60 * 60 * 1000;
  const visibleProjects = projects
    .filter((project) => !cutoff || Number(new Date(project.createdAt)) >= cutoff)
    .sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt)));

  const grouped = groupProjectsByContentTag(visibleProjects, tutorialById);
  const completed = visibleProjects.filter((project) => project.status === 'completed');
  const active = visibleProjects.filter((project) => {
    const jobStatus = latestJobByProject.get(project.id)?.status;
    return project.status === 'rendering' || jobStatus === 'queued' || jobStatus === 'running';
  });
  const attention = visibleProjects.filter((project) => project.status === 'failed' || project.publishTier === 'blocked' || latestJobByProject.get(project.id)?.status === 'failed' || latestJobByProject.get(project.id)?.status === 'cancelled');

  return (
    <StudioShell
      active="videos"
      title="视频库"
      subtitle="按内容标签整理视频，默认只看最近 3 天，后续视频多了也不会混在一起。"
      action={<Link href="/" {...newWindowLinkProps} style={linkButtonStyle('primary')}>制作新视频</Link>}
    >
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        <MetricTile label="当前范围" value={`${visibleProjects.length}`} note={filterLabel(activeDays)} />
        <MetricTile label="制作中" value={`${active.length}`} note="排队或正在制作" tone="#38bdf8" />
        <MetricTile label="已完成" value={`${completed.length}`} note="可预览下载" tone="#34d399" />
        <MetricTile label="需要处理" value={`${attention.length}`} note="失败或阻塞" tone={attention.length ? '#f87171' : '#94a3b8'} />
      </section>

      <Panel style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <SectionTitle title="按内容标签查看" note="分类优先来自文档类别，其次来自工具或内容标签。" />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <DayLink days="3" active={activeDays === '3'} text="最近 3 天" />
            <DayLink days="7" active={activeDays === '7'} text="最近 7 天" />
            <DayLink days="30" active={activeDays === '30'} text="最近 30 天" />
            <DayLink days="all" active={activeDays === 'all'} text="全部" />
          </div>
        </div>

        {visibleProjects.length === 0 ? (
          <EmptyGuide title="当前范围没有视频" text="可以切换更多天数，或者回到开始制作页创建新视频。" href="/" action="开始制作" />
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {grouped.map((group) => (
              <section key={group.label} style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 20 }}>{group.label}</h2>
                  <StatusBadge text={`${group.projects.length} 个视频`} tone="neutral" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
                  {group.projects.map((project) => {
                    const tutorial = tutorialById.get(project.tutorialId);
                    const videoAsset = assets.find((asset) => asset.projectId === project.id && asset.assetType === 'video' && asset.status === 'ready');
                    const latestJob = latestJobByProject.get(project.id);
                    const projectScenes = scenes.filter((scene) => scene.projectId === project.id);
                    const projectAssets = assets.filter((asset) => asset.projectId === project.id);
                    const progress = getVideoProgressSnapshot({ project, job: latestJob, scenes: projectScenes, assets: projectAssets });
                    const status = formatStatus(project.status, latestJob?.status);
                    return (
                      <article key={project.id} style={{ ...subtlePanelStyle, overflow: 'hidden', display: 'grid' }}>
                        <div style={{ aspectRatio: project.aspectRatio === '16:9' ? '16 / 9' : '9 / 12', background: 'linear-gradient(180deg, #172033 0%, #0f141d 100%)', display: 'grid', placeItems: 'center', color: '#64748b', fontWeight: 800 }}>
                          {videoAsset ? '视频已生成' : '等待输出'}
                        </div>
                        <div style={{ padding: 15, display: 'grid', gap: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                            <strong style={{ lineHeight: 1.45 }}>{project.title}</strong>
                            <StatusBadge text={status.text} tone={status.tone} />
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>{tutorial?.title || '未知来源文档'}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>{formatDate(project.createdAt)}</div>
                          <VideoProgressPanel projectId={project.id} initial={progress} />
                          {project.lastError || latestJob?.error ? <div style={{ color: '#fecaca', lineHeight: 1.55, fontSize: 13 }}>{project.lastError || latestJob?.error}</div> : null}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Link href={`/videos/${project.id}`} {...newWindowLinkProps} style={linkButtonStyle('secondary')}>打开</Link>
                            {videoAsset ? <a href={videoAsset.path} target="_blank" rel="noreferrer" style={linkButtonStyle('primary')}>预览/下载</a> : null}
                          </div>
                          <VideoCardActions projectId={project.id} canStop={progress.canStop} canRender={canRenderProject(project.status, latestJob?.status)} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </Panel>
    </StudioShell>
  );
}

function groupProjectsByContentTag<T extends { tutorialId: string; createdAt: string }>(projects: T[], tutorialById: Map<string, Tutorial>) {
  const groups = new Map<string, T[]>();
  for (const project of projects) {
    const tutorial = tutorialById.get(project.tutorialId);
    const label = pickContentLabel(tutorial);
    groups.set(label, [...(groups.get(label) || []), project]);
  }
  return Array.from(groups.entries())
    .map(([label, items]) => ({ label, projects: items.sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt))) }))
    .sort((a, b) => b.projects.length - a.projects.length || a.label.localeCompare(b.label, 'zh-CN'));
}

function pickContentLabel(tutorial?: Tutorial) {
  if (!tutorial) return '未分类';
  const category = tutorial.categories.find((item) => item && item !== 'AI教程');
  if (category) return category;
  if (tutorial.tools[0]) return tutorial.tools[0];
  const tag = tutorial.tags.find((item) => !item.startsWith('content-hash:') && !item.startsWith('source-name:'));
  if (tag) return tag;
  return '通用教程';
}

function DayLink({ days, active, text }: { days: DayFilter; active: boolean; text: string }) {
  return (
    <Link href={days === '3' ? '/videos' : `/videos?days=${days}`} style={{ textDecoration: 'none', borderRadius: 999, border: active ? '1px solid #38bdf8' : '1px solid #334155', background: active ? '#38bdf8' : '#1b2330', color: active ? '#061018' : '#cbd5e1', padding: '8px 12px', fontWeight: 800 }}>
      {text}
    </Link>
  );
}

function filterLabel(days: DayFilter) {
  if (days === 'all') return '全部历史视频';
  return `最近 ${days} 天`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatStatus(status: VideoProjectStatus, jobStatus?: string) {
  if (jobStatus === 'queued') return { text: '排队中', tone: 'info' as const };
  if (jobStatus === 'running') return { text: '制作中', tone: 'info' as const };
  if (jobStatus === 'cancelled') return { text: '已停止', tone: 'danger' as const };
  if (jobStatus === 'failed') return { text: '失败', tone: 'danger' as const };
  if (status === 'completed') return { text: '已完成', tone: 'success' as const };
  if (status === 'failed') return { text: '需要处理', tone: 'danger' as const };
  if (status === 'rendering') return { text: '制作中', tone: 'info' as const };
  if (status === 'storyboarded') return { text: '未开始生成', tone: 'warning' as const };
  return { text: '未开始生成', tone: 'neutral' as const };
}

function canRenderProject(status: VideoProjectStatus, jobStatus?: string) {
  if (jobStatus === 'queued' || jobStatus === 'running') return false;
  return status === 'storyboarded' || status === 'draft' || status === 'failed';
}
