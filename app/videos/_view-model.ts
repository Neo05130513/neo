import { getQualityReviews, getScripts, getTopics, getTutorials, getVideoAssets, getVideoProjects, getVideoRuntimeStatus, getVideoScenes } from '@/lib/queries';
import type { QualityReview, VideoAsset, VideoProject, VideoPublishTier, VideoVisualPreset } from '@/lib/types';

export type VideosView = 'focus' | 'failed' | 'pending' | 'rendering' | 'recent' | 'publishable' | 'review' | 'blocked';
export type VideosTierFilter = 'all' | VideoPublishTier;
export type VideosPresetFilter = 'all' | VideoVisualPreset;

export async function getVideosViewModel(searchParams?: { view?: string; tier?: string; preset?: string }) {
  const [projects, scenes, assets, scripts, topics, tutorials, runtimeStatus, qualityReviews] = await Promise.all([
    getVideoProjects(),
    getVideoScenes(),
    getVideoAssets(),
    getScripts(),
    getTopics(),
    getTutorials(),
    getVideoRuntimeStatus(),
    getQualityReviews()
  ]);

  const selectedTier = normalizeTier(searchParams?.tier);
  const selectedPreset = normalizePreset(searchParams?.preset);
  const activeView = normalizeView(searchParams?.view);
  const filteredProjects = projects.filter((project) => {
    const matchesTier = selectedTier === 'all' || (project.publishTier || 'pending') === selectedTier;
    const matchesPreset = selectedPreset === 'all' || (project.visualPreset || 'clarity-blue') === selectedPreset;
    return matchesTier && matchesPreset;
  });

  const failed = filteredProjects.filter((project) => project.status === 'failed');
  const pending = filteredProjects.filter((project) => project.status === 'draft' || project.status === 'storyboarded');
  const rendering = filteredProjects.filter((project) => project.status === 'rendering');
  const completed = filteredProjects.filter((project) => project.status === 'completed');
  const publishableProjects = filteredProjects.filter((project) => (project.publishTier || 'pending') === 'publishable');
  const reviewProjects = filteredProjects.filter((project) => (project.publishTier || 'pending') === 'review');
  const blockedProjects = filteredProjects.filter((project) => (project.publishTier || 'pending') === 'blocked');
  const recent = [...filteredProjects].sort((a, b) => Number(new Date(b.updatedAt)) - Number(new Date(a.updatedAt))).slice(0, 6);
  const recommended = failed[0] || pending[0] || rendering[0] || completed[0];
  const reviewedProjectIds = new Set(qualityReviews.map((item) => item.projectId));
  const latestReviewByProject = new Map(qualityReviews.map((item) => [item.projectId, item]));
  const unreviewedCompleted = completed.filter((project) => !reviewedProjectIds.has(project.id));
  const qualityRounds = summarizeQualityRounds(qualityReviews);
  const publishReadyTotal = filteredProjects.filter((project) => {
    const projectAssets = assets.filter((item) => item.projectId === project.id);
    return inferVideoQuality(project, projectAssets).label === '可发布';
  }).length;

  return {
    projects,
    scenes,
    assets,
    scripts,
    topics,
    tutorials,
    runtimeStatus,
    qualityReviews,
    selectedTier,
    selectedPreset,
    activeView,
    filteredProjects,
    failed,
    pending,
    rendering,
    completed,
    publishableProjects,
    reviewProjects,
    blockedProjects,
    recent,
    recommended,
    readyAssetTotal: assets.filter((asset) => asset.status === 'ready').length,
    latestQualityRound: qualityReviews[0]?.round || '未执行',
    sampledTotal: qualityReviews.length,
    latestReviewByProject,
    unreviewedCompleted,
    qualityRounds,
    publishReadyTotal,
    firstPublishable: publishableProjects[0],
    firstReview: reviewProjects[0],
    firstBlocked: blockedProjects[0]
  };
}

export function buildVideosViewHref(view: string, tier: string, preset: string) {
  const params = new URLSearchParams();
  params.set('view', view);
  if (tier !== 'all') params.set('tier', tier);
  if (preset !== 'all') params.set('preset', preset);
  return `/videos?${params.toString()}`;
}

export function inferVideoQuality(project: Pick<VideoProject, 'status' | 'publishTier' | 'publishScore'>, assets: Array<Pick<VideoAsset, 'assetType' | 'status'>>) {
  const knownTier = project.publishTier;
  if (knownTier) {
    const label = knownTier === 'publishable' ? '可发布' : knownTier === 'review' ? '需复核' : knownTier === 'blocked' ? '阻塞' : '待完成';
    return { label, score: project.publishScore || 0 };
  }

  if (project.status !== 'completed') return { label: '待完成', score: 0 };
  const readyVideo = assets.some((item) => item.assetType === 'video' && item.status === 'ready');
  const readySubtitles = assets.filter((item) => item.assetType === 'subtitle' && item.status === 'ready').length;
  if (readyVideo && readySubtitles >= 2) return { label: '可发布', score: 80 };
  return { label: '需复核', score: 60 };
}

export function formatIssueTag(tag: string) {
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

function normalizeView(value?: string): VideosView {
  return value === 'failed' || value === 'pending' || value === 'rendering' || value === 'recent' || value === 'publishable' || value === 'review' || value === 'blocked' ? value : 'focus';
}

function normalizeTier(value?: string): VideosTierFilter {
  return value === 'publishable' || value === 'review' || value === 'blocked' || value === 'pending' ? value : 'all';
}

function normalizePreset(value?: string): VideosPresetFilter {
  return value === 'clarity-blue' || value === 'midnight-cyan' || value === 'sunset-amber' ? value : 'all';
}

function summarizeQualityRounds(qualityReviews: QualityReview[]) {
  return Array.from(new Map(qualityReviews.map((review) => [review.round, qualityReviews.filter((item) => item.round === review.round)]))).map(([round, reviews]) => ({
    round,
    count: reviews.length,
    publishable: reviews.filter((item) => item.publishDecision === 'publishable').length,
    review: reviews.filter((item) => item.publishDecision === 'review').length,
    blocked: reviews.filter((item) => item.publishDecision === 'blocked').length,
    topIssueTags: summarizeTopIssueTags(reviews),
    latestAt: reviews[0]?.createdAt || ''
  }));
}

function summarizeTopIssueTags(reviews: Array<{ issueTags?: string[] }>) {
  const counts = new Map<string, number>();
  for (const review of reviews) {
    for (const tag of review.issueTags ?? []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);
}
