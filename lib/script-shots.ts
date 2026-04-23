import type { Script, Tutorial, VideoShotType, VideoVisualType } from './types';

export interface ScriptShotBreakdownItem {
  order: number;
  shotType: VideoShotType;
  title: string;
  voiceover: string;
  subtitle: string;
  visualPrompt: string;
  visualType: VideoVisualType;
  durationSec: number;
}

function cleanLine(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[-*•]\s*/, '')
    .trim();
}

function clip(value: string, maxLength: number) {
  const text = cleanLine(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

function estimateDuration(text: string) {
  const normalized = text.replace(/\s+/g, '');
  return Math.max(3, Math.ceil(normalized.length / 4));
}

function shotTitle(line: string, order: number) {
  return cleanLine(line)
    .replace(/^\d+[.、]\s*/, '')
    .replace(/^第\d+步[：:\s]*/, '')
    .replace(/^[一二三四五六七八九十]+、\s*/, '')
    .replace(/^补充说明\s*\d+[：:\s]*/, '')
    .split(/[。；;]/)[0]
    .replace(/[。；;]$/, '')
    .slice(0, 34) || `镜头 ${order}`;
}

function splitBodyLines(script: Script, tutorial?: Tutorial) {
  const bodyLines = script.body
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) => line && !/^总结一下/.test(line))
    .filter((line) => !/^补充说明\s*\d+/.test(line));

  const structured = bodyLines.filter((line) => (
    /^\d+[.、]/.test(line) ||
    /^[一二三四五六七八九十]+、/.test(line)
  ));
  if (structured.length >= 6) return structured;

  if (tutorial?.steps.length) {
    const stepLines = tutorial.steps.map((step) => cleanLine([step.title, step.detail].filter(Boolean).join('：')));
    return bodyLines.length >= 4 ? [...bodyLines, ...stepLines].slice(0, 28) : stepLines.slice(0, 28);
  }

  return bodyLines;
}

function parseBodyShot(line: string, fallbackOrder: number) {
  const withoutOrder = cleanLine(line).replace(/^\d+[.、]\s*/, '');
  const match = withoutOrder.match(/^(.{2,36}?)[：:]\s*(.+)$/);
  if (!match) {
    return { title: withoutOrder, voiceover: withoutOrder };
  }
  const title = cleanLine(match[1]) || `镜头 ${fallbackOrder}`;
  const voiceover = cleanLine(match[2]) || withoutOrder;
  return { title, voiceover };
}

function inferVisualType(text: string, shotType: VideoShotType): VideoVisualType {
  if (shotType === 'title' || shotType === 'cta') return 'slide';
  if (/步骤|流程|点击|选择|输入|上传|导入|生成|设置|操作|检查|确认/.test(text)) return 'screen';
  if (/数据|结果|提升|效率|对比|风险|问题|原因|趋势/.test(text)) return 'image';
  return 'caption';
}

function inferVisualPrompt(text: string, title: string, shotType: VideoShotType) {
  if (shotType === 'title') return `开场标题画面，突出主题：${title}`;
  if (shotType === 'cta') return `结尾总结画面，突出下一步行动：${title}`;
  if (/步骤|流程|点击|选择|输入|上传|导入|生成|设置|操作|检查|确认/.test(text)) {
    return `操作流程画面，分层展示：${clip(text, 90)}`;
  }
  if (/风险|注意|避免|不要|失败|问题/.test(text)) {
    return `风险提醒画面，用警示信息和要点卡片呈现：${clip(text, 90)}`;
  }
  return `讲解信息卡画面，围绕"${title}"展示关键概念和辅助图形。`;
}

export function buildScriptShotBreakdown(script: Script, tutorial?: Tutorial): ScriptShotBreakdownItem[] {
  const shots: ScriptShotBreakdownItem[] = [];
  const pushShot = (shotType: VideoShotType, title: string, voiceover: string) => {
    const order = shots.length + 1;
    const text = cleanLine(voiceover).replace(/^\d+[.、]\s*/, '');
    const nextTitle = shotTitle(title || text, order);
    shots.push({
      order,
      shotType,
      title: nextTitle,
      voiceover: text,
      subtitle: clip(text, 72),
      visualPrompt: inferVisualPrompt(text, nextTitle, shotType),
      visualType: inferVisualType(text, shotType),
      durationSec: estimateDuration(text)
    });
  };

  if (script.hook) pushShot('title', script.title, script.hook);
  for (const line of splitBodyLines(script, tutorial)) {
    const parsed = parseBodyShot(line, shots.length + 1);
    pushShot('step', parsed.title, parsed.voiceover);
  }
  if (script.cta) pushShot('cta', '总结与下一步', script.cta);

  return shots;
}
