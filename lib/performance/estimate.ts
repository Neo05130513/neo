import type { PerformanceSettings } from './settings';

export type GenerationEstimate = {
  inputChars: number;
  estimatedScriptChars: number;
  estimatedScenes: number;
  estimatedVideoSeconds: number;
  estimatedVideoDuration: string;
  estimatedGenerationMinMinutes: number;
  estimatedGenerationMaxMinutes: number;
  estimatedGenerationRange: string;
  steps: Array<{ id: string; title: string; range: string }>;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cleanLength(value: string) {
  return value.replace(/\s/g, '').length;
}

function formatDuration(seconds: number) {
  if (seconds < 120) return `约 ${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `约 ${minutes} 分 ${rest} 秒` : `约 ${minutes} 分钟`;
}

function formatRange(minMinutes: number, maxMinutes: number) {
  if (maxMinutes < 1) return '约 30-60 秒';
  if (minMinutes === maxMinutes) return `约 ${minMinutes} 分钟`;
  return `约 ${minMinutes}-${maxMinutes} 分钟`;
}

export function estimateGenerationFromText(input: {
  text: string;
  fileCount?: number;
  fileBytes?: number;
  autoRender?: boolean;
  settings?: Pick<PerformanceSettings, 'renderConcurrency' | 'ttsConcurrency' | 'imageConcurrency'>;
}): GenerationEstimate {
  const pastedChars = cleanLength(input.text);
  const fileChars = input.fileBytes ? Math.round(input.fileBytes / 2.2) : 0;
  const inputChars = clamp(pastedChars + fileChars, input.fileCount ? 500 : 0, 60000);
  const estimatedScriptChars = clamp(Math.round(inputChars * 0.62) + 420, 650, 4200);
  const estimatedVideoSeconds = clamp(Math.round(estimatedScriptChars / 4.2), 75, 900);
  const estimatedScenes = clamp(Math.ceil(estimatedVideoSeconds / 12) + 2, 6, 48);

  const parseMin = clamp(Math.ceil(inputChars / 12000), 1, 5);
  const scriptMin = clamp(Math.ceil(estimatedScriptChars / 1800), 1, 6);
  const storyboardMin = clamp(Math.ceil(estimatedScenes / 10), 1, 5);
  const ttsConcurrency = Math.max(1, input.settings?.ttsConcurrency || 1);
  const imageConcurrency = Math.max(1, input.settings?.imageConcurrency || 1);
  const renderConcurrency = Math.max(1, input.settings?.renderConcurrency || 1);
  const ttsMin = clamp(Math.ceil((estimatedScriptChars / 700) / ttsConcurrency), 1, 12);
  const imageMin = clamp(Math.ceil((estimatedScenes * 0.7) / imageConcurrency), 2, 30);
  const renderMin = input.autoRender === false ? 0 : clamp(Math.ceil((estimatedVideoSeconds / 55) / renderConcurrency), 2, 25);

  const min = parseMin + scriptMin + storyboardMin + ttsMin + Math.max(1, Math.floor(imageMin * 0.6)) + Math.max(0, Math.floor(renderMin * 0.7));
  const max = parseMin + scriptMin + storyboardMin + ttsMin + imageMin + renderMin + 3;

  return {
    inputChars,
    estimatedScriptChars,
    estimatedScenes,
    estimatedVideoSeconds,
    estimatedVideoDuration: formatDuration(estimatedVideoSeconds),
    estimatedGenerationMinMinutes: min,
    estimatedGenerationMaxMinutes: max,
    estimatedGenerationRange: formatRange(min, max),
    steps: [
      { id: 'import', title: '导入与理解文档', range: formatRange(parseMin, parseMin + 1) },
      { id: 'script', title: '撰写脚本', range: formatRange(scriptMin, scriptMin + 2) },
      { id: 'storyboard', title: '创建项目与分镜', range: formatRange(storyboardMin, storyboardMin + 1) },
      { id: 'tts', title: '生成旁白', range: formatRange(ttsMin, ttsMin + 2) },
      { id: 'visual', title: '生成画面素材', range: formatRange(Math.max(1, Math.floor(imageMin * 0.6)), imageMin) },
      { id: 'render', title: '渲染成片', range: input.autoRender === false ? '已关闭自动渲染' : formatRange(Math.max(1, Math.floor(renderMin * 0.7)), renderMin) }
    ]
  };
}
