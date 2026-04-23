import type { RenderJob, VideoAsset, VideoProject, VideoScene } from './types';

export type VideoProgressSnapshot = {
  label: string;
  detail: string;
  progress: number;
  canStop: boolean;
};

function percent(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

export function getVideoProgressSnapshot(params: {
  project: VideoProject;
  job?: RenderJob | null;
  scenes: VideoScene[];
  assets: VideoAsset[];
}): VideoProgressSnapshot {
  const { project, job, scenes, assets } = params;
  const videoReady = assets.some((asset) => asset.assetType === 'video' && asset.status === 'ready');
  const imageReady = assets.filter((asset) => asset.assetType === 'image' && asset.status === 'ready').length;
  const audioReady = assets.filter((asset) => asset.assetType === 'audio' && asset.status === 'ready').length;
  const subtitleReady = assets.filter((asset) => asset.assetType === 'subtitle' && asset.status === 'ready').length;
  const sceneCount = Math.max(1, scenes.length);

  if (job?.status === 'cancelled') {
    return { label: '已停止', detail: '用户已停止生成', progress: 100, canStop: false };
  }
  if (job?.status === 'failed' || project.status === 'failed') {
    return { label: '生成失败', detail: project.lastError || job?.error || '需要打开详情处理', progress: 100, canStop: false };
  }
  if (videoReady || job?.status === 'completed' || project.status === 'completed') {
    return { label: '成片完成', detail: '视频已生成，可预览或下载', progress: 100, canStop: false };
  }
  if (job?.status === 'queued') {
    return { label: '排队等待', detail: '任务已提交，正在等待并发空位或设备资源。此时可以停止生成。', progress: 12, canStop: true };
  }

  if (job?.status === 'running' || project.status === 'rendering') {
    if (subtitleReady > 0) {
      return { label: '合成成片', detail: '字幕已生成，正在输出最终视频', progress: Math.max(82, job?.progress || 82), canStop: true };
    }
    if (audioReady > 0) {
      return { label: '生成字幕', detail: `旁白 ${audioReady}/${sceneCount}，正在生成字幕时间轴`, progress: Math.max(64, Math.min(80, 58 + percent(audioReady, sceneCount) * 0.2)), canStop: true };
    }
    if (imageReady > 0) {
      return { label: '生成旁白', detail: `画面 ${imageReady}/${sceneCount}，正在生成旁白音频`, progress: Math.max(42, Math.min(62, 38 + percent(imageReady, sceneCount) * 0.24)), canStop: true };
    }
    return { label: '准备素材', detail: '正在生成画面、旁白和字幕素材', progress: Math.max(28, job?.progress || 28), canStop: true };
  }

  if (project.status === 'storyboarded') {
    return { label: '未开始生成', detail: `分镜已确认，共 ${scenes.length} 个镜头。点击“开始生成”后才会进入队列。`, progress: 24, canStop: false };
  }
  if (project.status === 'draft') {
    return { label: '未开始生成', detail: '项目已创建，但还没有提交生成任务。', progress: 10, canStop: false };
  }

  return { label: '未开始生成', detail: '还没有提交生成任务。', progress: 0, canStop: false };
}
