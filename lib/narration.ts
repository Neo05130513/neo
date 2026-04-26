import type { VideoScene } from './types';

const DIRECTOR_NOTE_PATTERNS = [
  /先把使用边界说清楚，后面的操作才不会混乱[。！]?/g,
  /先把适用场景交代清楚，后面的步骤才更容易看懂[。！]?/g,
  /先把[^。！？]*说清楚[。！]?/g,
  /后面的[^。！？]*才[^。！？]*[。！]?/g,
  /这里要讲清楚[^。！？]*[。！]?/g,
  /这一段要保留[^。！？]*[。！]?/g,
  /这一段主要是为了[^。！？]*[。！]?/g,
  /让观众知道为什么要这么做，而不是只看到一个操作结果[。！]?/g,
  /这一点要提前确认，否则流程看起来已经完成，实际结果还可能需要人工校验[。！]?/g,
  /如果这一步没提前确认，落地时通常还得返工或人工补一次[。！]?/g,
  /这一步做完，后面的流程才能顺着接上[。！]?/g,
  /画面可以先[^。！？]*[。！]?/g,
  /这里可以用[^。！？]*[。！]?/g
];

export function sanitizeNarrationText(value: string | undefined | null) {
  let cleaned = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

  for (const pattern of DIRECTOR_NOTE_PATTERNS) cleaned = cleaned.replace(pattern, '');

  return cleaned
    .replace(/[，,；;]{2,}/g, '，')
    .replace(/。{2,}/g, '。')
    .replace(/[，,；;]\s*[。！？]$/g, '。')
    .replace(/^[，,；;。！？\s]+/, '')
    .replace(/[，,；;。\s]+$/g, '')
    .trim();
}

export function sanitizeNarrationList(values: string[] | undefined) {
  const items = (values || [])
    .map((value) => sanitizeNarrationText(value))
    .filter(Boolean);

  return items.length ? Array.from(new Set(items)) : undefined;
}

export function sanitizeScriptBlock(value: string | undefined | null) {
  const normalized = String(value || '').replace(/\r/g, '\n');
  const lines = normalized
    .split(/\n+/)
    .map((line) => sanitizeNarrationText(line))
    .filter(Boolean);

  return lines.join('\n');
}

export function sanitizeSceneText<
  T extends Pick<VideoScene, 'voiceover' | 'subtitle' | 'headline' | 'cards' | 'emphasis' | 'keywords'>
>(scene: T): T {
  const headline = sanitizeNarrationText(scene.headline);
  const emphasis = sanitizeNarrationText(scene.emphasis);
  const cards = sanitizeNarrationList(scene.cards);
  const keywords = sanitizeNarrationList(scene.keywords);
  const fallbackText = sanitizeNarrationText(scene.subtitle) || headline || emphasis || cards?.[0] || keywords?.[0] || '';
  const voiceover = sanitizeNarrationText(scene.voiceover) || fallbackText;
  const compactVoiceover = voiceover.split(/[。！？；，、]/)[0]?.trim().slice(0, 18) || '';
  const subtitle = sanitizeNarrationText(scene.subtitle) || headline || emphasis || cards?.[0] || keywords?.[0] || compactVoiceover;

  return {
    ...scene,
    voiceover,
    subtitle,
    headline: headline || undefined,
    emphasis: emphasis || undefined,
    keywords,
    cards
  } as T;
}
