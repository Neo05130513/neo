import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { promisify } from 'util';
import path from 'path';
import { generateImageWithMiniMax, isMiniMaxConfigured, synthesizeSpeechWithMiniMax } from './providers/minimax';
import { nowIso, readJsonFile, simpleId, writeJsonFile, writeTextFile, ensureDirectory } from './storage';
import { commandExists, getExecutablePath } from './runtime/commands';
import { generatedRelativePath, publicPathFromRelative, resolveAppPath } from './runtime/paths';
import { buildScriptShotBreakdown } from './script-shots';
import { Script, StoryboardReview, Topic, Tutorial, VideoAspectRatio, VideoAsset, VideoOpsStatus, VideoProject, VideoPublishTier, VideoScene, VideoShotType, VideoTemplate, VideoVisualPreset, VideoVisualType } from './types';

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function withProjectError(project: VideoProject, message?: string): VideoProject {
  return {
    ...project,
    outputPath: undefined,
    lastError: message,
    lastRenderAttemptAt: nowIso(),
    updatedAt: nowIso()
  };
}

const execFileAsync = promisify(execFile);

const VISUAL_PRESETS: VideoVisualPreset[] = ['clarity-blue', 'midnight-cyan', 'sunset-amber'];

function pickVisualPreset(seed: string): VideoVisualPreset {
  const sum = seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return VISUAL_PRESETS[sum % VISUAL_PRESETS.length];
}

function getPresetPalette(preset: VideoVisualPreset) {
  switch (preset) {
    case 'clarity-blue':
      return { base: '#020617', panel: '#0f172a', accentTitle: '#38bdf8', accentPain: '#fb7185', accentStep: '#a78bfa', accentResult: '#34d399', accentCta: '#f59e0b' };
    case 'midnight-cyan':
      return { base: '#041022', panel: '#0a172d', accentTitle: '#22d3ee', accentPain: '#f472b6', accentStep: '#60a5fa', accentResult: '#2dd4bf', accentCta: '#fbbf24' };
    case 'sunset-amber':
      return { base: '#190d12', panel: '#261421', accentTitle: '#f97316', accentPain: '#fb7185', accentStep: '#f59e0b', accentResult: '#4ade80', accentCta: '#fde047' };
  }
}

function estimateDuration(text: string, minSeconds = 3) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return minSeconds;
  return Math.max(minSeconds, Math.ceil(normalized.length / 4));
}

function normalizeBodyLines(script: Script) {
  return script.body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^总结一下/.test(line));
}

function inferStepLines(script: Script, tutorial: Tutorial) {
  const bodyLines = normalizeBodyLines(script);
  const numbered = bodyLines.filter((line) => /^\d+[.、]/.test(line) || /^[一二三四五六七八九十]+、/.test(line) || /^补充说明\s*\d+/.test(line));
  if (numbered.length) return numbered;
  if (tutorial.steps.length) return tutorial.steps.map((step) => [step.title, step.detail].filter(Boolean).join('：'));
  return bodyLines;
}

function desiredSceneCount(script: Script) {
  const contentLines = normalizeBodyLines(script).filter((line) => line.length >= 10);
  return Math.min(28, Math.max(8, contentLines.length + 2));
}

function buildScene(params: {
  projectId: string;
  order: number;
  shotType: VideoShotType;
  visualType: VideoVisualType;
  visualPrompt: string;
  voiceover: string;
  subtitle?: string;
  layout?: VideoScene['layout'];
  headline?: string;
  emphasis?: string;
  keywords?: string[];
  cards?: string[];
  chartData?: number[];
  transition?: VideoScene['transition'];
}) : VideoScene {
  const subtitle = params.subtitle || params.voiceover;
  return {
    id: simpleId('video_scene'),
    projectId: params.projectId,
    order: params.order,
    shotType: params.shotType,
    visualType: params.visualType,
    visualPrompt: params.visualPrompt,
    voiceover: params.voiceover,
    subtitle,
    durationSec: estimateDuration(params.voiceover),
    layout: params.layout,
    headline: params.headline,
    emphasis: params.emphasis,
    keywords: params.keywords,
    cards: params.cards,
    chartData: params.chartData,
    transition: params.transition
  };
}

function sceneKeywords(text: string, fallback: string[] = []) {
  const words = text
    .split(/[，。！？；、：\s]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 10);
  return Array.from(new Set([...fallback, ...words])).slice(0, 5);
}

function sceneCards(text: string, maxItems = 4) {
  const parts = text
    .split(/[。！？；]/)
    .map((item) => item.replace(/^\d+[.、]\s*/, '').trim())
    .filter((item) => item.length >= 3);
  if (parts.length) return parts.slice(0, maxItems);
  return text.match(/.{1,12}/g)?.slice(0, maxItems) || [text];
}

function inferSemanticLayout(text: string, shotType: VideoShotType, order: number) {
  const normalized = text.replace(/^\d+[.、]\s*/, '').trim();
  if (shotType === 'title') return 'hero' as const;
  if (shotType === 'cta') return 'cta' as const;
  if (shotType === 'pain') {
    if (/误区|不要|别再|常见错误|陷阱/.test(normalized)) return 'mistake' as const;
    if (/原因|为什么|根源|导致|因为/.test(normalized)) return 'cause' as const;
    return 'contrast' as const;
  }
  if (shotType === 'result') {
    if (/数据|提升|增长|效率|比例|趋势|曲线/.test(normalized)) return 'chart' as const;
    if (/清单|检查|完成|具备|满足|准备好/.test(normalized)) return 'checklist' as const;
    return 'matrix' as const;
  }
  if (/时间线|阶段|先.*再|然后|最后|三步|四步|顺序/.test(normalized)) return 'timeline' as const;
  if (/关系|协同|联动|节点|网络|链路|连接/.test(normalized)) return 'network' as const;
  if (/层级|优先级|金字塔|底层|顶层/.test(normalized)) return 'pyramid' as const;
  if (/矩阵|维度|拆成.*块|象限/.test(normalized)) return 'matrix' as const;
  if (/清单|核对|检查|要点|标准/.test(normalized)) return 'checklist' as const;
  if (/流程|步骤|怎么做|操作|设置|执行/.test(normalized)) return 'process' as const;
  return chooseAiLayout(shotType, order);
}

function chooseAiLayout(shotType: VideoShotType, order: number) {
  if (shotType === 'title') return 'hero' as const;
  if (shotType === 'cta') return 'cta' as const;
  if (shotType === 'pain') {
    const variants = ['contrast', 'cause', 'mistake'] as const;
    return variants[(order - 1) % variants.length];
  }
  if (shotType === 'result') {
    const variants = ['chart', 'matrix', 'checklist'] as const;
    return variants[(order - 1) % variants.length];
  }
  const variants = ['process', 'timeline', 'network', 'checklist', 'matrix', 'pyramid'] as const;
  return variants[(order - 1) % variants.length];
}

function aiSceneMetadata(params: {
  shotType: VideoShotType;
  order: number;
  text: string;
  topic: Topic;
  tutorial: Tutorial;
  script: Script;
}): Pick<VideoScene, 'layout' | 'headline' | 'emphasis' | 'keywords' | 'cards' | 'chartData' | 'transition'> {
  const cleanedText = params.text.replace(/^\d+[.、]\s*/, '').trim();
  const layout = inferSemanticLayout(cleanedText, params.shotType, params.order);
  const titleSource =
    params.shotType === 'title'
      ? params.script.hook || params.script.title
      : params.shotType === 'cta'
        ? params.script.cta || cleanedText
        : cleanedText;
  const headline = titleSource.slice(0, 22);
  const emphasis =
    params.shotType === 'title'
      ? params.topic.angle
      : params.shotType === 'cta'
        ? '立即执行'
        : sceneKeywords(cleanedText, [params.topic.painPoint]).find((item) => item !== headline)?.slice(0, 14);
  const keywords = sceneKeywords(cleanedText, [params.topic.title, params.topic.angle, ...(params.tutorial.tags || []).slice(0, 2)]);
  const cards = sceneCards(cleanedText);
  const chartData =
    params.shotType === 'result'
      ? [26, 44, 58, 76, 91]
      : params.shotType === 'step' && (layout === 'matrix' || layout === 'network')
        ? [18, 32, 47, 63]
        : undefined;
  const transition =
    params.shotType === 'title'
      ? 'zoom'
      : params.shotType === 'cta'
        ? 'fade'
        : layout === 'timeline'
          ? 'push'
          : layout === 'mistake'
            ? 'flash'
            : 'wipe';

  return {
    layout,
    headline,
    emphasis,
    keywords,
    cards,
    chartData,
    transition
  };
}

function inferTechVisualType(text: string, shotType: VideoShotType): VideoVisualType {
  const value = text.toLowerCase();
  if (shotType === 'title' || shotType === 'cta') return 'slide';
  if (
    value.includes('数据') ||
    value.includes('增长') ||
    value.includes('提升') ||
    value.includes('效率') ||
    value.includes('趋势') ||
    value.includes('峰值')
  ) {
    return 'image';
  }
  if (
    value.includes('为什么') ||
    value.includes('原因') ||
    value.includes('误区') ||
    value.includes('避坑') ||
    value.includes('不要') ||
    value.includes('差距') ||
    value.includes('对比') ||
    value.includes('不会')
  ) {
    return 'caption';
  }
  if (
    value.includes('流程') ||
    value.includes('步骤') ||
    value.includes('节点') ||
    value.includes('工作流') ||
    value.includes('自动') ||
    value.includes('传递')
  ) {
    return 'screen';
  }
  return 'slide';
}

function buildTechVisualPrompt(params: {
  project: VideoProject;
  script: Script;
  topic: Topic;
  tutorial: Tutorial;
  shotType: VideoShotType;
  text: string;
  order: number;
}) {
  const base = `科技感信息图模板，自动根据文案选择版式，主题《${params.script.title}》`;
  const text = params.text.replace(/\s+/g, ' ').trim();
  switch (params.shotType) {
    case 'title':
      return `${base}；使用强钩子标题、关键词高亮、深蓝科技背景、半透明卡片和入场动效。`;
    case 'pain':
      return `${base}；用对比、因果拆解或避坑红绿卡呈现痛点：${text}`;
    case 'step':
      return `${base}；用流程图、时间线、节点网络、金字塔模型、分栏知识卡或图表呈现第 ${params.order - 2} 个核心要点：${text}`;
    case 'result':
      return `${base}；用趋势图、收益清单、能力矩阵或可复用规则包展示结果收益：${params.tutorial.summary || text}`;
    case 'cta':
      return `${base}；用收束标题、行动按钮、收藏提示和品牌化结尾呈现 CTA：${text}`;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapTextSvg(text: string, x: number, startY: number, lineHeight: number, maxChars = 14) {
  const lines = text.match(new RegExp(`.{1,${maxChars}}`, 'g')) || [''];
  return lines
    .map((line, index) => `<tspan x="${x}" y="${startY + index * lineHeight}">${escapeHtml(line)}</tspan>`)
    .join('');
}

function getSceneAccent(project: VideoProject, shotType: VideoShotType) {
  const palette = getPresetPalette(project.visualPreset || 'clarity-blue');
  switch (shotType) {
    case 'title':
      return palette.accentTitle;
    case 'pain':
      return palette.accentPain;
    case 'step':
      return palette.accentStep;
    case 'result':
      return palette.accentResult;
    case 'cta':
      return palette.accentCta;
  }
}

function summarizeVisualIntent(scene: VideoScene) {
  switch (scene.shotType) {
    case 'title':
      return 'hero opening frame with a confident presenter moment, premium lighting, strong focal point';
    case 'pain':
      return 'tense problem scene showing confusion, messy slides, information overload, high emotional contrast';
    case 'step':
      return 'clear workflow demonstration frame, computer screen in view, hands-on operation, product UI visible';
    case 'result':
      return 'successful polished outcome scene, elegant finished deck, confident business presentation, aspirational mood';
    case 'cta':
      return 'high-conversion ending card scene, clean composition, strong action energy, social media finish';
  }
}

function buildMiniMaxImagePrompt(project: VideoProject, scene: VideoScene) {
  const accent = getSceneAccent(project, scene.shotType);
  const safeSubtitle = scene.subtitle.replace(/[“”"']/g, '').slice(0, 120);
  const safeVisualPrompt = scene.visualPrompt.replace(/[“”"']/g, '').slice(0, 200);

  return [
    'Create one high-end cinematic vertical short-video keyframe for Chinese social media.',
    `Aspect ratio ${project.aspectRatio}, full-screen ${project.aspectRatio === '16:9' ? 'landscape' : 'portrait'} composition, realistic photography style, not illustration, not cartoon.`,
    'Subject matter: AI-powered product presentation workflow, modern Chinese tech workplace, premium monitor setup, clean desk, refined startup office atmosphere.',
    `Scene goal: ${summarizeVisualIntent(scene)}.`,
    `Video theme: ${project.title}.`,
    `Shot brief: ${safeVisualPrompt}.`,
    `On-screen story beat: ${safeSubtitle}.`,
    `Color cue: use ${accent} as a subtle accent light, keep preset ${project.visualPreset || 'clarity-blue'} consistency across scenes.`,
    'Visual quality: cinematic composition, realistic human hands, believable UI, depth of field, crisp subject, soft practical lighting, commercial ad quality, tasteful contrast.',
    'If a screen is visible, show elegant chart blocks, polished slide layouts, product screenshots, and presentation editing workflow; no gibberish text, no watermark, no logo clutter.',
    'Avoid poster design, avoid giant text blocks, avoid infographic layout, avoid flat template look, avoid low-detail stock image aesthetics.',
    'The image should feel like a frame from an expensive product trailer, emotionally clear, instantly readable, suitable for AI tutorial content.'
  ].join(' ');
}

function buildSceneSvg(project: VideoProject, scene: VideoScene) {
  const accent = getSceneAccent(project, scene.shotType);
  const label = scene.shotType.toUpperCase();
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#020617" />
      <stop offset="100%" stop-color="#111827" />
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)" />
  <rect x="72" y="96" width="220" height="56" rx="28" fill="${accent}" fill-opacity="0.18" stroke="${accent}" />
  <text x="182" y="132" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" fill="${accent}" font-weight="700">${label}</text>
  <text x="72" y="260" font-size="70" font-family="Arial, sans-serif" fill="#f8fafc" font-weight="700">${wrapTextSvg(project.title, 72, 260, 92, 12)}</text>
  <text x="72" y="620" font-size="50" font-family="Arial, sans-serif" fill="#cbd5e1" font-weight="500">${wrapTextSvg(scene.subtitle, 72, 620, 72, 16)}</text>
  <rect x="72" y="1510" width="936" height="260" rx="36" fill="#0f172a" fill-opacity="0.72" stroke="${accent}" stroke-opacity="0.45" />
  <text x="120" y="1588" font-size="30" font-family="Arial, sans-serif" fill="${accent}" font-weight="700">VISUAL PROMPT</text>
  <text x="120" y="1648" font-size="34" font-family="Arial, sans-serif" fill="#e2e8f0">${wrapTextSvg(scene.visualPrompt, 120, 1648, 52, 24)}</text>
</svg>`.trim();
}

function escapeDrawtext(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/,/g, '\\,')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function splitCaptionLines(text: string, maxChars: number, maxLines: number) {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return [''];

  const punctuated = compact
    .replace(/[。！？；]/g, '$&\n')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

  const lines: string[] = [];
  for (const segment of punctuated.length ? punctuated : [compact]) {
    const chunks = segment.match(new RegExp(`.{1,${maxChars}}`, 'g')) || [''];
    for (const chunk of chunks) {
      lines.push(chunk);
      if (lines.length >= maxLines) return lines;
    }
  }

  return lines.slice(0, maxLines);
}

function getDrawtextFontFile() {
  const candidates = [
    process.env.VIDEO_FACTORY_FONT_FILE,
    process.platform === 'darwin' ? '/System/Library/Fonts/Supplemental/PingFang.ttc' : undefined,
    process.platform === 'win32' ? 'C:/Windows/Fonts/msyh.ttc' : undefined,
    process.platform === 'win32' ? 'C:/Windows/Fonts/simhei.ttf' : undefined,
    process.platform === 'linux' ? '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc' : undefined,
    process.platform === 'linux' ? '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc' : undefined
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function drawTextFilter(params: { text: string; x: number; y: number; size: number; color: string; strong?: boolean }) {
  const escaped = escapeDrawtext(params.text);
  const border = params.strong ? ':borderw=2:bordercolor=#020617' : '';
  const fontFile = getDrawtextFontFile();
  const font = fontFile ? `:fontfile=${escapeDrawtext(fontFile)}` : '';
  return `drawtext=text='${escaped}':x=${params.x}:y=${params.y}:fontsize=${params.size}:fontcolor=${params.color}${font}${border}`;
}

async function createFallbackPngCard(project: VideoProject, scene: VideoScene, relativePath: string) {
  const absolutePath = resolveAppPath(relativePath);
  const accent = getSceneAccent(project, scene.shotType);
  const palette = getPresetPalette(project.visualPreset || 'clarity-blue');

  const titleLines = splitCaptionLines(project.title, 14, 3);
  const subtitleLines = splitCaptionLines(scene.subtitle, 20, 4);
  const promptLines = splitCaptionLines(scene.visualPrompt, 22, 3);
  const filters: string[] = [
    `drawbox=x=0:y=0:w=1080:h=1920:color=${palette.base}@1.0:t=fill`,
    `drawbox=x=70:y=90:w=250:h=64:color=${accent}@0.28:t=fill`,
    `drawbox=x=70:y=90:w=250:h=64:color=${accent}@0.95:t=2`,
    ...titleLines.map((line, index) => drawTextFilter({ text: line, x: 70, y: 250 + index * 88, size: 66, color: '#f8fafc', strong: true })),
    ...subtitleLines.map((line, index) => drawTextFilter({ text: line, x: 70, y: 700 + index * 66, size: 48, color: '#dbeafe' })),
    `drawbox=x=70:y=1460:w=940:h=330:color=${palette.panel}@0.76:t=fill`,
    `drawbox=x=70:y=1460:w=940:h=330:color=${accent}@0.55:t=2`,
    drawTextFilter({ text: scene.shotType.toUpperCase(), x: 102, y: 120, size: 30, color: accent, strong: true }),
    drawTextFilter({ text: 'VISUAL PROMPT', x: 110, y: 1538, size: 28, color: accent, strong: true }),
    ...promptLines.map((line, index) => drawTextFilter({ text: line, x: 110, y: 1602 + index * 54, size: 36, color: '#e2e8f0' }))
  ];

  await ensureDirectory(path.dirname(absolutePath));
  try {
    await execFileAsync(getExecutablePath('ffmpeg', 'FFMPEG_PATH'), [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=${palette.base}:s=1080x1920`,
      '-vf', filters.join(','),
      '-frames:v', '1',
      '-update', '1',
      absolutePath
    ]);
  } catch {
    await execFileAsync(getExecutablePath('ffmpeg', 'FFMPEG_PATH'), [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=${accent}:s=1080x1920`,
      '-frames:v', '1',
      '-update', '1',
      absolutePath
    ]);
  }
}

function evaluatePublishability(params: {
  status: VideoProject['status'];
  scenes: VideoScene[];
  assets: VideoAsset[];
  ffmpegReady: boolean;
  hasRenderError: boolean;
}) {
  if (params.status !== 'completed') {
    return {
      publishScore: 0,
      publishTier: (params.hasRenderError ? 'blocked' : 'pending') as VideoPublishTier
    };
  }

  const imageReady = params.assets.filter((asset) => asset.assetType === 'image' && asset.status === 'ready').length;
  const subtitleReady = params.assets.filter((asset) => asset.assetType === 'subtitle' && asset.status === 'ready').length;
  const videoReady = params.assets.some((asset) => asset.assetType === 'video' && asset.status === 'ready');
  const audioReady = params.assets.filter((asset) => asset.assetType === 'audio' && asset.status === 'ready').length;

  let score = 0;
  if (videoReady) score += 40;
  if (params.ffmpegReady) score += 20;
  if (params.scenes.length >= 6) score += 12;
  if (imageReady >= params.scenes.length) score += 12;
  if (subtitleReady >= 2) score += 10;
  if (audioReady > 0) score += 6;
  if (params.hasRenderError) score -= 20;

  const publishScore = Math.max(0, Math.min(100, score));
  const publishTier: VideoPublishTier = publishScore >= 80 ? 'publishable' : publishScore >= 60 ? 'review' : 'blocked';
  return { publishScore, publishTier };
}

async function createSceneImageAsset(project: VideoProject, scene: VideoScene) {
  const relativePath = generatedRelativePath('image', project.id, `${scene.order.toString().padStart(2, '0')}-${scene.shotType}.png`);

  if (isMiniMaxConfigured()) {
    try {
      const generated = await generateImageWithMiniMax({
        prompt: buildMiniMaxImagePrompt(project, scene),
        outputRelativePath: relativePath,
        width: 1080,
        height: 1920
      });
      if (generated) {
        return {
          relativePath,
          publicPath: generated.publicPath,
          provider: 'minimax' as const
        };
      }
      console.warn('MiniMax image generation returned empty payload; fallback to local card', {
        projectId: project.id,
        sceneId: scene.id,
        shotType: scene.shotType
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('MiniMax image generation failed; fallback to local card', {
        projectId: project.id,
        sceneId: scene.id,
        shotType: scene.shotType,
        message
      });
    }
  }

  await createFallbackPngCard(project, scene, relativePath);
  return {
    relativePath,
    publicPath: publicPathFromRelative(relativePath),
    provider: 'local-ffmpeg-card' as const
  };
}

async function createSceneAudioAsset(project: VideoProject, scene: VideoScene) {
  if (!isMiniMaxConfigured()) return null;

  const relativePath = generatedRelativePath('audio', project.id, `${scene.order.toString().padStart(2, '0')}-${scene.shotType}.mp3`);
  try {
    const generated = await synthesizeSpeechWithMiniMax({
      text: scene.voiceover,
      outputRelativePath: relativePath,
      format: 'mp3'
    });
    if (!generated) return null;
    return {
      relativePath,
      publicPath: generated.publicPath,
      provider: 'minimax' as const
    };
  } catch {
    return null;
  }
}

function buildSubtitleTimeline(project: VideoProject, scenes: VideoScene[]) {
  let current = 0;
  return scenes
    .sort((a, b) => a.order - b.order)
    .map((scene) => {
      const startSec = current;
      const endSec = current + scene.durationSec;
      current = endSec;
      return {
        projectId: project.id,
        sceneId: scene.id,
        order: scene.order,
        startSec,
        endSec,
        subtitle: scene.subtitle,
        voiceover: scene.voiceover
      };
    });
}

function formatSrtTime(totalSeconds: number) {
  const milliseconds = Math.round((totalSeconds % 1) * 1000);
  const wholeSeconds = Math.floor(totalSeconds);
  const seconds = wholeSeconds % 60;
  const minutes = Math.floor(wholeSeconds / 60) % 60;
  const hours = Math.floor(wholeSeconds / 3600);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

function buildSrtContent(timeline: ReturnType<typeof buildSubtitleTimeline>) {
  return timeline
    .map((item, index) => {
      const subtitleLines = splitCaptionLines(item.subtitle, 18, 3).join('\n');
      return `${index + 1}\n${formatSrtTime(item.startSec)} --> ${formatSrtTime(item.endSec)}\n${subtitleLines}\n`;
    })
    .join('\n');
}

async function isFfmpegAvailable() {
  return commandExists('ffmpeg', 'FFMPEG_PATH');
}

function formatFfmpegConcatPath(filePath: string) {
  return filePath.replace(/\\/g, '/').replace(/'/g, `'\\''`);
}

function buildFfmpegConcatContent(imageAbsolutePaths: string[], scenes: VideoScene[]) {
  const sortedScenes = [...scenes].sort((a, b) => a.order - b.order);
  const lines: string[] = [];

  sortedScenes.forEach((scene, index) => {
    const absoluteImagePath = imageAbsolutePaths[index];
    lines.push(`file '${formatFfmpegConcatPath(absoluteImagePath)}'`);
    lines.push(`duration ${scene.durationSec}`);
    if (index === sortedScenes.length - 1) {
      lines.push(`file '${formatFfmpegConcatPath(absoluteImagePath)}'`);
    }
  });

  return lines.join('\n') + '\n';
}

function buildFfmpegAudioInputs(audioAbsolutePaths: string[]) {
  return audioAbsolutePaths.flatMap((audioPath) => ['-i', audioPath]);
}

function buildFfmpegAudioFilter(audioCount: number) {
  return Array.from({ length: audioCount }, (_, index) => `[${index + 1}:a]`).join('') + `concat=n=${audioCount}:v=0:a=1[aout]`;
}

async function runFfmpegRender(params: {
  projectId: string;
  scenes: VideoScene[];
  subtitleSrtRelativePath: string;
  imageAbsolutePaths: string[];
  audioAbsolutePaths: string[];
}) {
  const concatRelativePath = generatedRelativePath('video', params.projectId, 'inputs.txt');
  const outputRelativePath = generatedRelativePath('video', params.projectId, 'output.mp4');
  await writeTextFile(concatRelativePath, buildFfmpegConcatContent(params.imageAbsolutePaths, params.scenes));

  const concatAbsolutePath = resolveAppPath(concatRelativePath);
  const outputAbsolutePath = resolveAppPath(outputRelativePath);

  const args = [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatAbsolutePath,
    ...buildFfmpegAudioInputs(params.audioAbsolutePaths)
  ];

  if (params.audioAbsolutePaths.length > 0) {
    args.push(
      '-filter_complex', buildFfmpegAudioFilter(params.audioAbsolutePaths.length),
      '-map', '0:v:0',
      '-map', '[aout]',
      '-pix_fmt', 'yuv420p',
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-shortest',
      '-r', '30',
      outputAbsolutePath
    );
  } else {
    args.push(
      '-pix_fmt', 'yuv420p',
      '-c:v', 'libx264',
      '-r', '30',
      outputAbsolutePath
    );
  }

  await execFileAsync(getExecutablePath('ffmpeg', 'FFMPEG_PATH'), args);

  return {
    concatRelativePath,
    outputRelativePath
  };
}

async function readVideoState() {
  const [projects, scenes, assets, scripts, topics, tutorials] = await Promise.all([
    readJsonFile<VideoProject[]>('data/video-projects.json'),
    readJsonFile<VideoScene[]>('data/video-scenes.json'),
    readJsonFile<VideoAsset[]>('data/video-assets.json'),
    readJsonFile<Script[]>('data/scripts.json'),
    readJsonFile<Topic[]>('data/topics.json'),
    readJsonFile<Tutorial[]>('data/tutorials.json')
  ]);

  return { projects, scenes, assets, scripts, topics, tutorials };
}

function ensureScriptTopicTutorial(state: Awaited<ReturnType<typeof readVideoState>>, project: VideoProject) {
  const script = state.scripts.find((item) => item.id === project.scriptId);
  if (!script) throw new Error('Script not found');
  const topic = state.topics.find((item) => item.id === project.topicId);
  if (!topic) throw new Error('Topic not found');
  const tutorial = state.tutorials.find((item) => item.id === project.tutorialId);
  if (!tutorial) throw new Error('Tutorial not found');
  return { script, topic, tutorial };
}

function ensureScriptTopicTutorialByScript(state: Awaited<ReturnType<typeof readVideoState>>, scriptId: string) {
  const script = state.scripts.find((item) => item.id === scriptId);
  if (!script) throw new Error('Script not found');
  const topic = state.topics.find((item) => item.id === script.topicId);
  if (!topic) throw new Error('Topic not found');
  const tutorial = state.tutorials.find((item) => item.id === script.tutorialId);
  if (!tutorial) throw new Error('Tutorial not found');
  return { script, topic, tutorial };
}

export function buildStoryboard(project: VideoProject, script: Script, topic: Topic, tutorial: Tutorial): VideoScene[] {
  const scriptShots = buildScriptShotBreakdown(script, tutorial);
  const useTechTemplate = project.template === 'tech-explainer-v1' || project.template === 'ai-explainer-short-v1';

  return scriptShots.map((shot) => {
    const shotType = shot.shotType;
    const aiMeta = project.template === 'ai-explainer-short-v1'
      ? aiSceneMetadata({ shotType, order: shot.order, text: shot.voiceover, topic, tutorial, script })
      : null;
    return buildScene({
      projectId: project.id,
      order: shot.order,
      shotType,
      visualType: useTechTemplate ? inferTechVisualType(shot.voiceover, shotType) : shot.visualType,
      visualPrompt: useTechTemplate
        ? buildTechVisualPrompt({ project, script, topic, tutorial, shotType, text: shot.voiceover, order: shot.order })
        : shot.visualPrompt,
      voiceover: shot.voiceover,
      subtitle: shot.subtitle,
      layout: aiMeta?.layout,
      headline: aiMeta?.headline,
      emphasis: aiMeta?.emphasis,
      keywords: aiMeta?.keywords,
      cards: aiMeta?.cards,
      chartData: aiMeta?.chartData,
      transition: aiMeta?.transition
    });
  });
}

export async function buildStoryboardWithPlanner(project: VideoProject, script: Script, topic: Topic, tutorial: Tutorial): Promise<VideoScene[]> {
  const fallbackScenes = buildStoryboard(project, script, topic, tutorial);
  await appendStoryboardReview({
    projectId: project.id,
    source: 'rule-fallback',
    score: 0,
    issues: ['使用客户确认的脚本镜头拆解'],
    retried: false,
    usedFallback: true,
    scenes: fallbackScenes
  });
  return fallbackScenes;
}

async function appendStoryboardReview(params: {
  projectId: string;
  source: StoryboardReview['source'];
  model?: string;
  endpoint?: string;
  score: number;
  issues: string[];
  retried: boolean;
  usedFallback: boolean;
  scenes: VideoScene[];
}) {
  let reviews: StoryboardReview[] = [];
  try {
    reviews = await readJsonFile<StoryboardReview[]>('data/storyboard-reviews.json');
  } catch {}

  const totalDurationSec = params.scenes.reduce((total, scene) => total + scene.durationSec, 0);
  const review: StoryboardReview = {
    id: simpleId('storyboard_review'),
    projectId: params.projectId,
    source: params.source,
    model: params.model,
    endpoint: params.endpoint,
    score: params.score,
    issues: params.issues,
    retried: params.retried,
    usedFallback: params.usedFallback,
    sceneCount: params.scenes.length,
    totalDurationSec: Number(totalDurationSec.toFixed(1)),
    createdAt: nowIso()
  };

  await writeJsonFile('data/storyboard-reviews.json', [review, ...reviews].slice(0, 500));
}

export async function createVideoProjectFromScript(scriptId: string, options: { aspectRatio?: VideoAspectRatio; template?: VideoTemplate } = {}) {
  return createVideoProjectFromScriptWithOptions(scriptId, options);
}

export async function createVideoProjectFromScriptWithOptions(scriptId: string, options: { aspectRatio?: VideoAspectRatio; template?: VideoTemplate }) {
  const state = await readVideoState();

  const script = state.scripts.find((item) => item.id === scriptId);
  if (!script) throw new Error('Script not found');

  const topic = state.topics.find((item) => item.id === script.topicId);
  if (!topic) throw new Error('Topic not found');

  const tutorial = state.tutorials.find((item) => item.id === script.tutorialId);
  if (!tutorial) throw new Error('Tutorial not found');

  const timestamp = nowIso();
  const project: VideoProject = {
    id: simpleId('video_project'),
    tutorialId: tutorial.id,
    topicId: topic.id,
    scriptId: script.id,
    status: 'draft',
    template: options.template || 'ai-explainer-short-v1',
    title: script.title,
    aspectRatio: options.aspectRatio || '9:16',
    createdAt: timestamp,
    updatedAt: timestamp,
    lastError: undefined,
    lastRenderAttemptAt: undefined,
    visualPreset: pickVisualPreset(script.id),
    publishScore: 0,
    publishTier: 'pending',
    opsStatus: 'idle',
    opsUpdatedAt: timestamp
  };

  const projectScenes = await buildStoryboardWithPlanner(project, script, topic, tutorial);
  const nextProjects = [project, ...state.projects];
  const nextScenes = [...projectScenes, ...state.scenes];

  project.status = 'storyboarded';
  project.updatedAt = nowIso();
  nextProjects[0] = project;

  await Promise.all([
    writeJsonFile('data/video-projects.json', nextProjects),
    writeJsonFile('data/video-scenes.json', nextScenes)
  ]);

  return { project, scenes: projectScenes, script, topic, tutorial };
}

export async function createVideoProjectsBatch(scriptIds: string[], options: { aspectRatio?: VideoAspectRatio; template?: VideoTemplate } = {}) {
  const results = [];
  for (const scriptId of scriptIds) {
    results.push(await createVideoProjectFromScriptWithOptions(scriptId, options));
  }
  return results;
}

export async function regenerateStoryboard(projectId: string) {
  const state = await readVideoState();

  const projectIndex = state.projects.findIndex((item) => item.id === projectId);
  if (projectIndex === -1) throw new Error('Video project not found');

  const project = state.projects[projectIndex];
  const { script, topic, tutorial } = ensureScriptTopicTutorial(state, project);

  const nextProject: VideoProject = {
    ...project,
    status: 'storyboarded',
    updatedAt: nowIso(),
    lastError: undefined
  };
  const projectScenes = await buildStoryboardWithPlanner(nextProject, script, topic, tutorial);

  state.projects[projectIndex] = nextProject;
  const nextScenes = [...projectScenes, ...state.scenes.filter((item) => item.projectId !== projectId)];

  await Promise.all([
    writeJsonFile('data/video-projects.json', state.projects),
    writeJsonFile('data/video-scenes.json', nextScenes)
  ]);

  return { project: nextProject, scenes: projectScenes };
}

export async function regenerateStoryboardFromScript(projectId: string, scriptId: string) {
  const state = await readVideoState();

  const projectIndex = state.projects.findIndex((item) => item.id === projectId);
  if (projectIndex === -1) throw new Error('Video project not found');

  const project = state.projects[projectIndex];
  const { script, topic, tutorial } = ensureScriptTopicTutorialByScript(state, scriptId);

  const nextProject: VideoProject = {
    ...project,
    tutorialId: tutorial.id,
    topicId: topic.id,
    scriptId: script.id,
    title: script.title,
    status: 'storyboarded',
    updatedAt: nowIso(),
    lastError: undefined,
    opsStatus: 'queued_rework',
    opsUpdatedAt: nowIso()
  };
  const projectScenes = await buildStoryboardWithPlanner(nextProject, script, topic, tutorial);

  state.projects[projectIndex] = nextProject;
  const nextScenes = [...projectScenes, ...state.scenes.filter((item) => item.projectId !== projectId)];

  await Promise.all([
    writeJsonFile('data/video-projects.json', state.projects),
    writeJsonFile('data/video-scenes.json', nextScenes)
  ]);

  return { project: nextProject, scenes: projectScenes, script, topic, tutorial };
}

export async function updateVideoProjectsOpsStatus(projectIds: string[], opsStatus: VideoOpsStatus) {  if (!projectIds.length) {
    return { updated: 0 };
  }

  const projects = await readJsonFile<VideoProject[]>('data/video-projects.json');
  const idSet = new Set(projectIds);
  let updated = 0;
  const timestamp = nowIso();

  const nextProjects = projects.map((project) => {
    if (!idSet.has(project.id)) return project;
    updated += 1;
    return {
      ...project,
      opsStatus,
      opsUpdatedAt: timestamp,
      updatedAt: timestamp
    };
  });

  await writeJsonFile('data/video-projects.json', nextProjects);
  return { updated, opsStatus };
}

export async function deleteVideoProject(projectId: string) {
  const state = await readVideoState();
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error('Video project not found');
  const [renderJobs, storyboardReviews, qualityReviews] = await Promise.all([
    readJsonFile<import('./types').RenderJob[]>('data/render-jobs.json').catch(() => []),
    readJsonFile<import('./types').StoryboardReview[]>('data/storyboard-reviews.json').catch(() => []),
    readJsonFile<import('./types').QualityReview[]>('data/quality-reviews.json').catch(() => [])
  ]);

  await Promise.all([
    writeJsonFile('data/video-projects.json', state.projects.filter((item) => item.id !== projectId)),
    writeJsonFile('data/video-scenes.json', state.scenes.filter((item) => item.projectId !== projectId)),
    writeJsonFile('data/video-assets.json', state.assets.filter((item) => item.projectId !== projectId)),
    writeJsonFile('data/render-jobs.json', renderJobs.filter((item) => item.projectId !== projectId)),
    writeJsonFile('data/storyboard-reviews.json', storyboardReviews.filter((item) => item.projectId !== projectId)),
    writeJsonFile('data/quality-reviews.json', qualityReviews.filter((item) => item.projectId !== projectId))
  ]);

  return { project };
}

export async function renderVideoProject(projectId: string) {
  const state = await readVideoState();
  const projectIndex = state.projects.findIndex((item) => item.id === projectId);
  if (projectIndex === -1) throw new Error('Video project not found');

  const project = state.projects[projectIndex];
  const projectScenes = state.scenes
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => a.order - b.order);

  if (!projectScenes.length) throw new Error('No storyboard scenes found');

  const renderingProject: VideoProject = {
    ...project,
    status: 'rendering',
    outputPath: undefined,
    lastError: undefined,
    lastRenderAttemptAt: nowIso(),
    updatedAt: nowIso()
  };
  state.projects[projectIndex] = renderingProject;
  await writeJsonFile('data/video-projects.json', state.projects);

  try {
    const nextAssets = state.assets.filter((item) => item.projectId !== projectId);
    const createdAssets: VideoAsset[] = [];
    const imageAbsolutePaths: string[] = [];
    const audioAbsolutePaths: string[] = [];

    for (const scene of projectScenes) {
      const generatedImage = await createSceneImageAsset(renderingProject, scene);
      createdAssets.push({
        id: simpleId('video_asset'),
        projectId,
        sceneId: scene.id,
        assetType: 'image',
        path: generatedImage.publicPath,
        status: 'ready'
      });
      imageAbsolutePaths.push(resolveAppPath(generatedImage.relativePath));

      const generatedAudio = await createSceneAudioAsset(renderingProject, scene);
      if (generatedAudio) {
        createdAssets.push({
          id: simpleId('video_asset'),
          projectId,
          sceneId: scene.id,
          assetType: 'audio',
          path: generatedAudio.publicPath,
          status: 'ready'
        });
        audioAbsolutePaths.push(resolveAppPath(generatedAudio.relativePath));
      }
    }

    const subtitleTimeline = buildSubtitleTimeline(renderingProject, projectScenes);
    const subtitleJsonRelativePath = generatedRelativePath('subtitles', projectId, 'timeline.json');
    const subtitleSrtRelativePath = generatedRelativePath('subtitles', projectId, 'captions.srt');
    await writeTextFile(subtitleJsonRelativePath, JSON.stringify(subtitleTimeline, null, 2) + '\n');
    await writeTextFile(subtitleSrtRelativePath, buildSrtContent(subtitleTimeline));

    createdAssets.push({
      id: simpleId('video_asset'),
      projectId,
      sceneId: projectScenes[0].id,
      assetType: 'subtitle',
      path: publicPathFromRelative(subtitleJsonRelativePath),
      status: 'ready'
    });
    createdAssets.push({
      id: simpleId('video_asset'),
      projectId,
      sceneId: projectScenes[0].id,
      assetType: 'subtitle',
      path: publicPathFromRelative(subtitleSrtRelativePath),
      status: 'ready'
    });

    const renderManifestRelativePath = generatedRelativePath('video', projectId, 'render-manifest.json');
    const renderManifest = {
      projectId,
      status: 'ready_for_ffmpeg',
      title: renderingProject.title,
      template: renderingProject.template,
      aspectRatio: renderingProject.aspectRatio,
      scenes: projectScenes.map((scene) => ({
        order: scene.order,
        shotType: scene.shotType,
        durationSec: scene.durationSec,
        imagePath: createdAssets.find((asset) => asset.sceneId === scene.id && asset.assetType === 'image')?.path,
        audioPath: createdAssets.find((asset) => asset.sceneId === scene.id && asset.assetType === 'audio')?.path,
        subtitle: scene.subtitle,
        voiceover: scene.voiceover
      })),
      subtitles: {
        timelineJson: publicPathFromRelative(subtitleJsonRelativePath),
        srt: publicPathFromRelative(subtitleSrtRelativePath)
      }
    };
    await writeTextFile(renderManifestRelativePath, JSON.stringify(renderManifest, null, 2) + '\n');

    let outputPath = publicPathFromRelative(renderManifestRelativePath);
    let ffmpegReady = false;

    if (await isFfmpegAvailable()) {
      const ffmpegOutput = await runFfmpegRender({
        projectId,
        scenes: projectScenes,
        subtitleSrtRelativePath,
        imageAbsolutePaths,
        audioAbsolutePaths
      });
      outputPath = publicPathFromRelative(ffmpegOutput.outputRelativePath);
      ffmpegReady = true;
      createdAssets.push({
        id: simpleId('video_asset'),
        projectId,
        sceneId: projectScenes[0].id,
        assetType: 'video',
        path: outputPath,
        status: 'ready'
      });
    } else {
      createdAssets.push({
        id: simpleId('video_asset'),
        projectId,
        sceneId: projectScenes[0].id,
        assetType: 'video',
        path: publicPathFromRelative(renderManifestRelativePath),
        status: 'failed'
      });
    }

    const completedProject: VideoProject = {
      ...renderingProject,
      status: ffmpegReady ? 'completed' : 'failed',
      updatedAt: nowIso(),
      outputPath,
      lastError: ffmpegReady ? undefined : 'ffmpeg not available; render manifest generated instead of mp4'
    };
    const publishability = evaluatePublishability({
      status: completedProject.status,
      scenes: projectScenes,
      assets: createdAssets,
      ffmpegReady,
      hasRenderError: Boolean(completedProject.lastError)
    });
    completedProject.publishScore = publishability.publishScore;
    completedProject.publishTier = publishability.publishTier;
    state.projects[projectIndex] = completedProject;

    await Promise.all([
      writeJsonFile('data/video-projects.json', state.projects),
      writeJsonFile('data/video-assets.json', [...createdAssets, ...nextAssets])
    ]);

    return {
      project: completedProject,
      scenes: projectScenes,
      assets: createdAssets,
      subtitleTimeline,
      renderManifest,
      ffmpegReady
    };
  } catch (error) {
    state.projects[projectIndex] = withProjectError(
      {
        ...renderingProject,
        status: 'failed',
        publishScore: 0,
        publishTier: 'blocked'
      },
      formatErrorMessage(error)
    );
    await writeJsonFile('data/video-projects.json', state.projects);
    throw error;
  }
}
