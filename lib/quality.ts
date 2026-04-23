import { nowIso, readJsonFile, simpleId, writeJsonFile } from './storage';
import { QualityReview, VideoAsset, VideoProject, VideoScene } from './types';

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function inferIssueTags(params: {
  project: VideoProject;
  scenes: VideoScene[];
  imageReady: number;
  subtitleReady: number;
  videoReady: boolean;
  visualScore: number;
  subtitleScore: number;
  rhythmScore: number;
}) {
  const tags: string[] = [];

  if (!params.videoReady) tags.push('missing-final-video');
  if (params.imageReady < params.scenes.length) tags.push('image-coverage-gap');
  if (params.subtitleReady < 2) tags.push('subtitle-coverage-gap');
  if (params.scenes.length < 6) tags.push('scene-density-low');
  if (params.visualScore < 88) tags.push('visual-clarity-risk');
  if (params.subtitleScore < 78) tags.push('subtitle-readability-risk');
  if (params.rhythmScore < 76) tags.push('rhythm-pacing-risk');
  if (params.project.visualPreset === 'sunset-amber') tags.push('preset-needs-human-check');

  return tags;
}

function buildRecommendations(issueTags: string[]) {
  const recommendations: string[] = [];

  if (issueTags.includes('missing-final-video')) recommendations.push('优先补齐最终视频输出，避免只完成素材而未形成成片。');
  if (issueTags.includes('image-coverage-gap')) recommendations.push('补齐镜头图片覆盖，确保每个 scene 都有可交付画面。');
  if (issueTags.includes('subtitle-coverage-gap')) recommendations.push('增加字幕覆盖并缩短单条字幕长度，优先提升可读性。');
  if (issueTags.includes('scene-density-low')) recommendations.push('增加步骤镜头或结果镜头，避免视频信息密度过低。');
  if (issueTags.includes('visual-clarity-risk')) recommendations.push('优化标题卡和结果卡的主视觉，减少画面信息冲突。');
  if (issueTags.includes('subtitle-readability-risk')) recommendations.push('压缩旁白文案，减少字幕单屏字数和切换压力。');
  if (issueTags.includes('rhythm-pacing-risk')) recommendations.push('重新调整场景时长，压缩拖沓镜头并强化节奏峰值。');
  if (issueTags.includes('preset-needs-human-check')) recommendations.push('对 sunset-amber 预设样片做人工复核，确认色彩和信息对比度。');

  if (recommendations.length === 0) {
    recommendations.push('结构完整，建议进入人工抽检后直接推进发布。');
  }

  return recommendations;
}

function evaluateProject(project: VideoProject, scenes: VideoScene[], assets: VideoAsset[]) {
  const imageReady = assets.filter((item) => item.assetType === 'image' && item.status === 'ready').length;
  const subtitleReady = assets.filter((item) => item.assetType === 'subtitle' && item.status === 'ready').length;
  const videoReady = assets.some((item) => item.assetType === 'video' && item.status === 'ready');
  const base = project.publishScore ?? 0;

  const visualScore = clampScore(base * 0.55 + (imageReady >= scenes.length ? 28 : 14) + (videoReady ? 14 : 0));
  const subtitleScore = clampScore((subtitleReady >= 2 ? 74 : 48) + Math.min(16, scenes.length));
  const rhythmScore = clampScore((scenes.length >= 6 ? 70 : 56) + (project.visualPreset === 'sunset-amber' ? 8 : 4));
  const finalScore = Math.round((visualScore + subtitleScore + rhythmScore) / 3);

  const publishDecision: QualityReview['publishDecision'] = finalScore >= 80 ? 'publishable' : finalScore >= 65 ? 'review' : 'blocked';
  const issueTags = inferIssueTags({ project, scenes, imageReady, subtitleReady, videoReady, visualScore, subtitleScore, rhythmScore });
  const recommendations = buildRecommendations(issueTags);
  const notes = publishDecision === 'publishable'
    ? '结构完整，可进入人工抽检后发布。'
    : publishDecision === 'review'
      ? '建议优化字幕节奏或镜头信息密度。'
      : '建议重做分镜和素材后再复检。';

  return { visualScore, subtitleScore, rhythmScore, publishDecision, notes, issueTags, recommendations };
}

export async function runAutoQualitySampling(sampleSize = 3, round = `round-${new Date().toISOString().slice(0, 10)}`) {
  const [projects, scenes, assets, reviews] = await Promise.all([
    readJsonFile<VideoProject[]>('data/video-projects.json'),
    readJsonFile<VideoScene[]>('data/video-scenes.json'),
    readJsonFile<VideoAsset[]>('data/video-assets.json'),
    readJsonFile<QualityReview[]>('data/quality-reviews.json')
  ]);

  const normalizedReviews = reviews.map((review) => ({
    ...review,
    issueTags: review.issueTags ?? [],
    recommendations: review.recommendations ?? []
  }));

  const reviewedThisRound = new Set(normalizedReviews.filter((item) => item.round === round).map((item) => item.projectId));
  const reviewedAnyRound = new Set(normalizedReviews.map((item) => item.projectId));

  const freshCandidates = projects
    .filter((project) => project.status === 'completed' && !reviewedAnyRound.has(project.id) && !reviewedThisRound.has(project.id))
    .sort((a, b) => Number(new Date(b.updatedAt)) - Number(new Date(a.updatedAt)))
    .slice(0, sampleSize);

  const fallbackCandidates = projects
    .filter((project) => project.status === 'completed' && !reviewedThisRound.has(project.id) && !freshCandidates.some((item) => item.id === project.id))
    .sort((a, b) => Number(new Date(b.updatedAt)) - Number(new Date(a.updatedAt)))
    .slice(0, Math.max(0, sampleSize - freshCandidates.length));

  const candidates = [...freshCandidates, ...fallbackCandidates];

  const created: QualityReview[] = candidates.map((project) => {
    const projectScenes = scenes.filter((item) => item.projectId === project.id);
    const projectAssets = assets.filter((item) => item.projectId === project.id);
    const result = evaluateProject(project, projectScenes, projectAssets);
    return {
      id: simpleId('quality_review'),
      projectId: project.id,
      reviewer: 'auto-sampler',
      round,
      visualScore: result.visualScore,
      subtitleScore: result.subtitleScore,
      rhythmScore: result.rhythmScore,
      publishDecision: result.publishDecision,
      notes: result.notes,
      issueTags: result.issueTags,
      recommendations: result.recommendations,
      createdAt: nowIso()
    };
  });

  if (created.length > 0 || normalizedReviews.some((item) => !item.issueTags || !item.recommendations)) {
    await writeJsonFile('data/quality-reviews.json', [...created, ...normalizedReviews]);
  }

  return {
    round,
    sampled: created.length,
    reviews: created
  };
}
