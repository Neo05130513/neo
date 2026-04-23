import { generateTextWithMiniMax, isMiniMaxConfigured } from './providers/minimax';
import { simpleId } from './storage';
import type {
  Script,
  Topic,
  Tutorial,
  VideoProject,
  VideoScene,
  VideoSceneLayout,
  VideoShotType,
  VideoVisualType
} from './types';

const ALLOWED_LAYOUTS: VideoSceneLayout[] = [
  'hero',
  'contrast',
  'network',
  'process',
  'chart',
  'matrix',
  'checklist',
  'cta',
  'cause',
  'timeline',
  'mistake',
  'pyramid'
];

const ALLOWED_SHOT_TYPES: VideoShotType[] = ['title', 'pain', 'step', 'result', 'cta'];
const ALLOWED_VISUAL_TYPES: VideoVisualType[] = ['slide', 'screen', 'image', 'caption'];

type PlannedScene = {
  shotType?: VideoShotType;
  layout?: VideoSceneLayout;
  visualType?: VideoVisualType;
  durationSec?: number;
  voiceover?: string;
  subtitle?: string;
  headline?: string;
  emphasis?: string;
  visualPrompt?: string;
  keywords?: string[];
  cards?: string[];
  chartData?: number[];
  transition?: VideoScene['transition'];
};

type PlannedStoryboard = {
  videoTitle?: string;
  targetDurationSec?: number;
  scenes?: PlannedScene[];
};

type RewrittenScript = {
  title?: string;
  hook?: string;
  body?: string;
  cta?: string;
  keyPhrases?: string[];
};

type StoryboardScore = {
  score: number;
  issues: string[];
};

type PlanningSegment = {
  index: number;
  total: number;
  title: string;
  content: string;
};

function clipText(value: unknown, fallback: string, maxChars: number) {
  const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return (text || fallback).slice(0, maxChars);
}

function cleanArray(value: unknown, maxItems: number, maxChars: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => clipText(item, '', maxChars))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanNumbers(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
    .slice(0, maxItems);
}

function clampDuration(value: unknown, fallback = 4) {
  const duration = Number(value);
  if (!Number.isFinite(duration)) return fallback;
  return Math.max(2.5, Number(duration.toFixed(1)));
}

function extractJson(raw: string): PlannedStoryboard {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || raw;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('MiniMax storyboard response did not contain a JSON object');
  }
  return JSON.parse(source.slice(start, end + 1)) as PlannedStoryboard;
}

function extractJsonObject<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || raw;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('MiniMax response did not contain a JSON object');
  }
  return JSON.parse(source.slice(start, end + 1)) as T;
}

function inferVisualType(layout: VideoSceneLayout): VideoVisualType {
  if (layout === 'chart') return 'image';
  if (layout === 'network' || layout === 'process' || layout === 'timeline') return 'screen';
  if (layout === 'contrast' || layout === 'cause' || layout === 'mistake' || layout === 'checklist') return 'caption';
  return 'slide';
}

function defaultLayout(shotType: VideoShotType): VideoSceneLayout {
  if (shotType === 'title') return 'hero';
  if (shotType === 'pain') return 'contrast';
  if (shotType === 'result') return 'checklist';
  if (shotType === 'cta') return 'cta';
  return 'process';
}

function normalizeScene(projectId: string, scene: PlannedScene, index: number): VideoScene | null {
  const shotType = ALLOWED_SHOT_TYPES.includes(scene.shotType as VideoShotType)
    ? scene.shotType as VideoShotType
    : index === 0 ? 'title' : 'step';
  const layout = ALLOWED_LAYOUTS.includes(scene.layout as VideoSceneLayout)
    ? scene.layout as VideoSceneLayout
    : defaultLayout(shotType);
  const visualType = ALLOWED_VISUAL_TYPES.includes(scene.visualType as VideoVisualType)
    ? scene.visualType as VideoVisualType
    : inferVisualType(layout);
  const voiceover = clipText(scene.voiceover, scene.subtitle || scene.headline || '', 1200);
  if (!voiceover) return null;
  const subtitle = clipText(scene.subtitle, voiceover, 80);
  const headline = clipText(scene.headline, subtitle, 60);

  return {
    id: simpleId('video_scene'),
    projectId,
    order: index + 1,
    shotType,
    visualType,
    visualPrompt: clipText(scene.visualPrompt, `使用 ${layout} 版式呈现：${headline}`, 500),
    voiceover,
    subtitle,
    durationSec: clampDuration(scene.durationSec, Math.max(3, Math.ceil(voiceover.length / 18))),
    layout,
    headline,
    emphasis: clipText(scene.emphasis, '', 16) || undefined,
    keywords: cleanArray(scene.keywords, 6, 12),
    cards: cleanArray(scene.cards, 6, 18),
    chartData: cleanNumbers(scene.chartData, 8),
    transition: scene.transition
  };
}

function ensureStoryboardShape(project: VideoProject, planned: PlannedStoryboard) {
  const scenes = Array.isArray(planned.scenes) ? planned.scenes : [];
  const normalized = scenes
    .map((scene, index) => normalizeScene(project.id, scene, index))
    .filter((scene): scene is VideoScene => Boolean(scene));

  if (normalized.length < 4) {
    throw new Error('MiniMax storyboard returned too few valid scenes');
  }

  normalized[0] = {
    ...normalized[0],
    shotType: 'title',
    layout: 'hero',
    visualType: 'slide',
    order: 1
  };

  const lastIndex = normalized.length - 1;
  normalized[lastIndex] = {
    ...normalized[lastIndex],
    shotType: 'cta',
    layout: 'cta',
    visualType: 'slide',
    order: normalized.length
  };

  return normalized.map((scene, index) => ({
    ...scene,
    order: index + 1
  }));
}

function sceneLayouts(scenes: VideoScene[]) {
  return scenes.map((scene) => scene.layout || defaultLayout(scene.shotType));
}

function scoreStoryboard(scenes: VideoScene[], targetDurationSec: number): StoryboardScore {
  const issues: string[] = [];
  let score = 100;
  const totalDuration = scenes.reduce((total, scene) => total + scene.durationSec, 0);
  const layouts = sceneLayouts(scenes);
  const uniqueLayouts = new Set(layouts).size;
  const repeatedLayoutCount = layouts.filter((layout, index) => index > 0 && layout === layouts[index - 1]).length;
  const hasStructuredPayload = scenes.filter((scene) => (scene.cards?.length || 0) >= 2 || (scene.chartData?.length || 0) >= 5).length;

  if (scenes.length < 5) {
    score -= 18;
    issues.push('镜头数量少于 5 个');
  }
  if (scenes[0]?.shotType !== 'title' || scenes[0]?.layout !== 'hero') {
    score -= 12;
    issues.push('开场镜头不是 hero title');
  }
  if (scenes[scenes.length - 1]?.shotType !== 'cta') {
    score -= 10;
    issues.push('缺少结尾 CTA');
  }
  if (!scenes.some((scene) => scene.shotType === 'pain' || scene.layout === 'contrast' || scene.layout === 'cause')) {
    score -= 10;
    issues.push('缺少痛点/冲突镜头');
  }
  if (!scenes.some((scene) => scene.shotType === 'result' || scene.layout === 'checklist' || scene.layout === 'chart')) {
    score -= 10;
    issues.push('缺少结果/收益镜头');
  }
  if (uniqueLayouts < Math.min(5, scenes.length - 1)) {
    score -= 14;
    issues.push('版式变化不足');
  }
  if (repeatedLayoutCount >= 2) {
    score -= 8;
    issues.push('连续重复版式过多');
  }
  if (scenes.some((scene) => scene.subtitle.length > 80)) {
    score -= 6;
    issues.push('字幕超过模板建议长度');
  }
  if (scenes.some((scene) => scene.voiceover.length > 1200)) {
    score -= 8;
    issues.push('单镜头旁白过长，建议拆镜');
  }
  if (hasStructuredPayload < Math.max(2, Math.floor(scenes.length / 3))) {
    score -= 10;
    issues.push('结构化视觉字段不足');
  }
  if (Math.abs(totalDuration - targetDurationSec) > Math.max(10, targetDurationSec * 0.35)) {
    score -= 8;
    issues.push('总时长偏离目标过多');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues
  };
}

function chooseTargetDuration(script: Script) {
  const explicitMatches = Array.from(script.duration.matchAll(/\d+/g)).map((match) => Number(match[0])).filter(Number.isFinite);
  const explicit = explicitMatches.length ? Math.max(...explicitMatches) : NaN;
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(20, explicit);
  const textLength = [script.hook, script.body, script.cta].join('\n').replace(/\s+/g, '').length;
  if (textLength > 0) return Math.max(75, Math.ceil(textLength / 4.2));
  return 75;
}

function splitParagraphs(text: string) {
  return text
    .split(/\n{2,}|(?<=。|！|？|；)\s*/g)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length > 8);
}

function buildPlanningBlocks(script: Script, topic: Topic, tutorial: Tutorial) {
  const stepBlocks = tutorial.steps.map((step, index) => ({
    title: step.title || `步骤 ${index + 1}`,
    content: [step.title, step.detail].filter(Boolean).join('\n')
  })).filter((item) => item.content.trim());

  if (stepBlocks.length) return stepBlocks;

  const rawBlocks = splitParagraphs(tutorial.rawContent || '').map((content, index) => ({
    title: `原文段落 ${index + 1}`,
    content
  }));
  if (rawBlocks.length) return rawBlocks;

  return splitParagraphs(script.body).map((content, index) => ({
    title: `脚本段落 ${index + 1}`,
    content
  }));
}

function buildPlanningSegments(script: Script, topic: Topic, tutorial: Tutorial): PlanningSegment[] {
  const blocks = buildPlanningBlocks(script, topic, tutorial);
  const totalSourceLength = blocks.reduce((total, block) => total + block.content.length, 0);
  if (blocks.length <= 8 && totalSourceLength <= 3200) return [];

  const segments: Array<Omit<PlanningSegment, 'index' | 'total'>> = [];
  let currentTitle = '';
  let currentContent = '';
  const maxCharsPerSegment = 3200;

  for (const block of blocks) {
    const next = currentContent ? `${currentContent}\n\n## ${block.title}\n${block.content}` : `## ${block.title}\n${block.content}`;
    if (currentContent && next.length > maxCharsPerSegment) {
      segments.push({ title: currentTitle || '内容段', content: currentContent });
      currentTitle = block.title;
      currentContent = `## ${block.title}\n${block.content}`;
    } else {
      currentTitle = currentTitle || block.title;
      currentContent = next;
    }
  }

  if (currentContent) segments.push({ title: currentTitle || '内容段', content: currentContent });
  return segments.map((segment, index) => ({
    ...segment,
    index: index + 1,
    total: segments.length
  }));
}

async function rewriteScriptForShortVideo(params: {
  script: Script;
  topic: Topic;
  tutorial: Tutorial;
}) {
  const estimatedDuration = chooseTargetDuration(params.script);
  if (estimatedDuration > 240) return params.script;

  const systemPrompt = [
    '你是中文文档讲解视频口播改写专家。',
    '只输出 JSON，不要 Markdown，不要解释。',
    '目标：在不改变原文逻辑的前提下，让讲稿更适合科技感信息图视频。',
    '不要按平台改写，不要压缩成短视频模板，保留输入脚本的主要信息量。',
    'hook 必须清楚说明文档解决的问题。',
    'body 用换行分段，段落数量跟随原文内容，不要强行限制为固定句数。',
    'cta 简洁自然。',
    'keyPhrases 给 4 到 8 个关键词，每个不超过 8 个汉字。',
    '输出格式：{"title":"...","hook":"...","body":"...","cta":"...","keyPhrases":["..."]}。'
  ].join('\n');

  const userPrompt = JSON.stringify({
    script: {
      title: params.script.title,
      hook: params.script.hook,
      body: params.script.body,
      cta: params.script.cta,
      style: params.script.style
    },
    topic: {
      title: params.topic.title,
      angle: params.topic.angle,
      painPoint: params.topic.painPoint,
      audience: params.topic.audience
    },
    tutorial: {
      title: params.tutorial.title,
      summary: params.tutorial.summary,
      tools: params.tutorial.tools,
      methods: params.tutorial.methods,
      steps: params.tutorial.steps.slice(0, 6),
      risks: params.tutorial.risks.slice(0, 3)
    }
  }, null, 2);

  const generated = await generateTextWithMiniMax({
    systemPrompt,
    userPrompt,
    temperature: 0.45,
    maxTokens: 1800
  });
  if (!generated) return params.script;

  const rewritten = extractJsonObject<RewrittenScript>(generated.text);
  return {
    ...params.script,
    title: clipText(rewritten.title, params.script.title, 48),
    hook: clipText(rewritten.hook, params.script.hook, 72),
    body: clipText(rewritten.body, params.script.body, Math.max(900, params.script.body.length)),
    cta: clipText(rewritten.cta, params.script.cta, 36),
    style: `${params.script.style}；MiniMax短视频口播改写；关键词：${cleanArray(rewritten.keyPhrases, 8, 8).join('、')}`
  };
}

function buildPlannerPrompt(project: VideoProject, script: Script, topic: Topic, tutorial: Tutorial) {
  return JSON.stringify({
    project: {
      title: project.title,
      template: project.template,
      aspectRatio: project.aspectRatio,
      visualPreset: project.visualPreset
    },
    script: {
      duration: script.duration,
      title: script.title,
      hook: script.hook,
      body: script.body,
      cta: script.cta,
      style: script.style
    },
    topic: {
      title: topic.title,
      angle: topic.angle,
      painPoint: topic.painPoint,
      audience: topic.audience
    },
    tutorial: {
      title: tutorial.title,
      summary: tutorial.summary,
      tools: tutorial.tools,
      methods: tutorial.methods,
      steps: tutorial.steps,
      risks: tutorial.risks,
      rawContent: tutorial.rawContent && tutorial.rawContent.length <= 12000 ? tutorial.rawContent : undefined
    }
  }, null, 2);
}

async function generateStoryboardAttempt(params: {
  project: VideoProject;
  script: Script;
  topic: Topic;
  tutorial: Tutorial;
  retryIssues?: string[];
  segment?: PlanningSegment;
  longForm?: boolean;
}) {
  const targetDurationSec = chooseTargetDuration(params.script);
  const segmentSuffix = params.segment
    ? `这是长视频的第 ${params.segment.index}/${params.segment.total} 段，只规划本段内容，不要加整片开场和整片结尾。`
    : '';
  const systemPrompt = [
    params.longForm ? '你是长视频课程分镜导演，专门制作中文科技感信息图解说视频。' : '你是短视频分镜导演，专门制作中文科技感信息图解说视频。',
    '只输出 JSON，不要 Markdown，不要解释。',
    '你必须把输入脚本拆成可由 Remotion 渲染的结构化分镜。',
    `layout 只能使用：${ALLOWED_LAYOUTS.join(', ')}。`,
    `shotType 只能使用：${ALLOWED_SHOT_TYPES.join(', ')}。`,
    `visualType 只能使用：${ALLOWED_VISUAL_TYPES.join(', ')}。`,
    params.longForm ? '镜头数量必须根据内容密度决定，不要压缩内容；一个知识点可以拆多个镜头。单镜头建议 8 到 90 秒，必要时可更长。' : '镜头数量根据内容决定，不要固定 8 个。单镜头建议 3 到 30 秒。',
    params.longForm ? 'voiceover 要完整覆盖本段内容，不要为了短而删重点；subtitle 是屏幕标题，可以短一些。' : 'voiceover 要口语、有节奏；subtitle 是屏幕标题，不要替代完整旁白。',
    'cards 用于卡片/节点/对比项，最多 6 个，每个尽量短。',
    'chartData 只在 chart 版式需要时给 5 到 8 个数字。',
    'transition 必须从 push、zoom、flash、wipe、fade 中选择，每个镜头都给。',
    '优先使用 hero、contrast、cause、timeline、network、chart、matrix、mistake、pyramid、checklist、cta 的多样组合。',
    `目标总时长约 ${targetDurationSec} 秒。`,
    segmentSuffix,
    params.retryIssues?.length ? `上一版问题：${params.retryIssues.join('；')}。请修正这些问题。` : '',
    '输出格式：{"videoTitle":"...","targetDurationSec":35,"scenes":[...]}。'
  ].filter(Boolean).join('\n');

  const prompt = params.segment
    ? JSON.stringify({
      ...JSON.parse(buildPlannerPrompt(params.project, params.script, params.topic, params.tutorial)),
      segment: params.segment
    }, null, 2)
    : buildPlannerPrompt(params.project, params.script, params.topic, params.tutorial);

  const generated = await generateTextWithMiniMax({
    systemPrompt,
    userPrompt: prompt,
    temperature: params.retryIssues?.length ? 0.42 : 0.35,
    maxTokens: params.longForm ? 12000 : 4096
  });

  if (!generated) return null;
  const planned = extractJson(generated.text);
  const scenes = ensureStoryboardShape(params.project, planned);
  const quality = scoreStoryboard(scenes, Number(planned.targetDurationSec) || targetDurationSec);
  return {
    scenes,
    quality,
    rawText: generated.text,
    model: generated.model,
    endpoint: generated.endpoint
  };
}

async function planLongFormStoryboard(params: {
  project: VideoProject;
  script: Script;
  topic: Topic;
  tutorial: Tutorial;
  segments: PlanningSegment[];
}) {
  const allScenes: VideoScene[] = [];
  const issues: string[] = [];
  let model = '';
  let endpoint = '';

  allScenes.push({
    id: simpleId('video_scene'),
    projectId: params.project.id,
    order: 1,
    shotType: 'title',
    visualType: 'slide',
    visualPrompt: `长视频开场，说明主题与学习收益：${params.script.title}`,
    voiceover: params.script.hook || `这节内容我们系统讲清楚：${params.script.title}`,
    subtitle: params.script.title,
    durationSec: clampDuration(undefined, Math.max(6, Math.ceil((params.script.hook || params.script.title).length / 4))),
    layout: 'hero',
    headline: params.script.title,
    emphasis: params.topic.angle,
    transition: 'zoom'
  });

  for (const segment of params.segments) {
    let attempt: Awaited<ReturnType<typeof generateStoryboardAttempt>> = null;
    try {
      attempt = await generateStoryboardAttempt({
        ...params,
        segment,
        longForm: true
      });
    } catch (error) {
      issues.push(`第 ${segment.index} 段生成失败：${error instanceof Error ? error.message : String(error)}`);
    }

    if (!attempt?.scenes.length) {
      issues.push(`第 ${segment.index} 段未生成有效分镜，已跳过`);
      continue;
    }
    model = attempt.model;
    endpoint = attempt.endpoint;
    issues.push(...attempt.quality.issues.map((issue) => `第 ${segment.index} 段：${issue}`));
    const segmentScenes = attempt.scenes.filter((scene) => scene.shotType !== 'title' && scene.shotType !== 'cta');
    for (const scene of segmentScenes) {
      allScenes.push(scene);
    }
  }

  allScenes.push({
    id: simpleId('video_scene'),
    projectId: params.project.id,
    order: allScenes.length + 1,
    shotType: 'cta',
    visualType: 'slide',
    visualPrompt: '长视频结尾，总结核心收获并引导复习或进入下一课',
    voiceover: params.script.cta || '这节内容先到这里，建议收藏后按步骤复盘一遍。',
    subtitle: '下一步行动',
    durationSec: clampDuration(undefined, Math.max(6, Math.ceil((params.script.cta || '').length / 4))),
    layout: 'cta',
    headline: '下一步行动',
    emphasis: '收藏复盘',
    transition: 'fade'
  });

  if (allScenes.length <= 2) {
    throw new Error(`长视频分段分镜没有生成有效内容镜头：${issues.join('；')}`);
  }

  const scenes = allScenes.map((scene, index) => ({
    ...scene,
    id: scene.id || simpleId('video_scene'),
    projectId: params.project.id,
    order: index + 1
  }));
  const targetDuration = scenes.reduce((total, scene) => total + scene.durationSec, 0);
  return {
    scenes,
    quality: scoreStoryboard(scenes, targetDuration),
    rawText: `long-form segmented storyboard: ${params.segments.length} segments`,
    model,
    endpoint,
    retried: false,
    issues
  };
}

export async function planStoryboardWithMiniMax(params: {
  project: VideoProject;
  script: Script;
  topic: Topic;
  tutorial: Tutorial;
}) {
  if (!isMiniMaxConfigured()) return null;

  const segments = buildPlanningSegments(params.script, params.topic, params.tutorial);
  if (segments.length) {
    const result = await planLongFormStoryboard({
      ...params,
      segments
    });
    return {
      scenes: result.scenes,
      rawText: result.rawText,
      model: result.model,
      endpoint: result.endpoint,
      quality: {
        score: result.quality.score,
        issues: [...result.quality.issues, ...result.issues]
      },
      retried: result.retried
    };
  }

  const rewrittenScript = await rewriteScriptForShortVideo({
    script: params.script,
    topic: params.topic,
    tutorial: params.tutorial
  });
  const first = await generateStoryboardAttempt({
    ...params,
    script: rewrittenScript
  });
  if (!first) return null;
  const retried = first.quality.score < 78;
  const result = !retried
    ? first
    : await generateStoryboardAttempt({
      ...params,
      script: rewrittenScript,
      retryIssues: first.quality.issues
    }) || first;

  return {
    scenes: result.scenes,
    rawText: result.rawText,
    model: result.model,
    endpoint: result.endpoint,
    quality: result.quality,
    retried
  };
}
