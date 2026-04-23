import { Tutorial, TutorialStep } from './types';
import { extractSections, keywordIncludes, summarizeContent } from './text';

const TOOL_KEYWORDS = ['扣子空间', '即梦', 'DeepSeek', '豆包', 'ChatGPT', 'Claude', 'Cursor'];
const METHOD_KEYWORDS = ['ASK MAP', '一句话传递价值', '多点型展示价值', '对比式强化价值', '匹配对应场景', '搭配展示台子', '配套概念素材'];
const RISK_PATTERNS = ['不能', '不要', '注意', '提醒', '风险', '校验'];
const SCENARIO_KEYWORDS = ['路演', '招商', '客户', '投资人', '线下体验店', '产品介绍'];
const AUDIENCE_KEYWORDS = ['产品经理', '销售', '市场人员', '创业者', '投资人', '经销商', '消费者'];

function takeMatches(raw: string, keywords: string[]) {
  return keywords.filter((item) => raw.includes(item));
}

function extractSteps(lines: string[]): TutorialStep[] {
  const stepLines = lines.filter((line) => /^\d+[.、]/.test(line) || /^第[一二三四五六七八九十]+/.test(line));
  if (stepLines.length >= 3) {
    return stepLines.slice(0, 10).map((line) => ({ title: line, detail: '' }));
  }

  const actionLines = lines.filter((line) => (
    /步骤|流程|操作|点击|选择|输入|上传|导入|生成|设置|打开|保存|复制|检查|确认/.test(line)
  ) && line.length >= 10 && line.length <= 160);

  return actionLines.slice(0, 10).map((line, index) => ({
    title: `步骤 ${index + 1}`,
    detail: line
  }));
}

function extractQuotes(lines: string[]) {
  return lines.filter((line) => line.length >= 12 && line.length <= 80).slice(0, 10);
}

function extractRisks(lines: string[]) {
  return lines.filter((line) => RISK_PATTERNS.some((pattern) => line.includes(pattern))).slice(0, 8);
}

function inferCategories(raw: string) {
  const categories = ['AI教程'];
  if (keywordIncludes(raw, ['PPT', '办公', '产品介绍'])) categories.push('AI办公提效');
  if (keywordIncludes(raw, ['视频', '即梦'])) categories.push('AI视频与音频');
  return Array.from(new Set(categories));
}

export function parseTutorial(base: Tutorial): Tutorial {
  const lines = extractSections(base.rawContent);
  const title = lines[0] || base.title;
  const summary = summarizeContent(base.rawContent);
  const targetAudience = takeMatches(base.rawContent, AUDIENCE_KEYWORDS);
  const scenarios = takeMatches(base.rawContent, SCENARIO_KEYWORDS);
  const tools = takeMatches(base.rawContent, TOOL_KEYWORDS);
  const methods = takeMatches(base.rawContent, METHOD_KEYWORDS);
  const steps = extractSteps(lines);
  const keyQuotes = extractQuotes(lines);
  const risks = extractRisks(lines);
  const categories = inferCategories(base.rawContent);
  const preservedSystemTags = base.tags.filter((tag) => tag.startsWith('content-hash:'));
  const tags = Array.from(new Set([...preservedSystemTags, ...targetAudience, ...scenarios, ...tools, ...methods]));

  return {
    ...base,
    title,
    summary,
    targetAudience,
    scenarios,
    tools,
    methods,
    steps,
    keyQuotes,
    risks,
    categories,
    tags,
    shortVideoScore: Math.min(100, 50 + tools.length * 5 + methods.length * 5 + risks.length * 2),
    priority: 'high',
    status: 'parsed',
    updatedAt: new Date().toISOString()
  };
}
