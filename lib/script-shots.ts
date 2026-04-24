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

function inferBodyShotType(text: string, index: number, total: number): VideoShotType {
  const normalized = cleanLine(text);
  const painPattern = /为什么|问题|痛点|卡住|失败|出错|误区|陷阱|不要|别再|常见错误|风险|难点|空白|浪费|冲突|对比|差距|原因/;
  const resultPattern = /结果|效果|提升|增长|收益|更快|更稳|更省|减少|降低|优化|完成|实现|最终|所以|因此|回报|改善|更适合|复用/;
  const ctaPattern = /现在就|记得|建议你|可以先|马上|下一步|去试|去做|收藏|转发|点赞/;

  if (painPattern.test(normalized)) return 'pain';
  if (ctaPattern.test(normalized) && index >= total - 2) return 'result';
  if (resultPattern.test(normalized) && index >= Math.max(1, total - 3)) return 'result';
  if (index === 0 && /为什么|问题|误区|不要|别再/.test(normalized)) return 'pain';
  if (index === total - 1 && /总结|最后|最终|所以|因此|结果|效果/.test(normalized)) return 'result';
  return 'step';
}

function inferVisualType(text: string, shotType: VideoShotType): VideoVisualType {
  if (shotType === 'title' || shotType === 'cta') return 'slide';
  if (shotType === 'pain') return 'caption';
  if (shotType === 'result') return /数据|提升|增长|趋势|效率|比例|结果/.test(text) ? 'image' : 'caption';
  if (/步骤|流程|点击|选择|输入|上传|导入|生成|设置|操作|检查|确认/.test(text)) return 'screen';
  if (/数据|结果|提升|效率|对比|风险|问题|原因|趋势|网络|关系|结构/.test(text)) return 'image';
  return 'caption';
}

function inferVisualPrompt(text: string, title: string, shotType: VideoShotType) {
  if (shotType === 'title') return `开场标题画面，突出主题：${title}`;
  if (shotType === 'cta') return `结尾总结画面，突出下一步行动：${title}`;
  if (shotType === 'pain') return `问题拆解画面，用对比、警示标记和冲突结构呈现：${clip(text, 90)}`;
  if (shotType === 'result') return `结果展示画面，用数据、收益变化或完成态反馈呈现：${clip(text, 90)}`;
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
  const bodyLines = splitBodyLines(script, tutorial);
  bodyLines.forEach((line, index) => {
    const parsed = parseBodyShot(line, shots.length + 1);
    const shotType = inferBodyShotType(parsed.voiceover, index, bodyLines.length);
    pushShot(shotType, parsed.title, parsed.voiceover);
  });
  if (script.cta) pushShot('cta', '总结与下一步', script.cta);

  return shots;
}
