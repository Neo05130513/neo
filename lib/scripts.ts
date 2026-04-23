import { Script, Topic, Tutorial } from './types';
import { generateTextWithMiniMax, isMiniMaxConfigured } from './providers/minimax';
import { nowIso, simpleId } from './storage';

interface ProfessionalShot {
  title: string;
  voiceover: string;
  visualPrompt?: string;
}

interface ProfessionalScriptDraft {
  title: string;
  hook: string;
  shots: ProfessionalShot[];
  cta: string;
}

const LOW_VALUE_PATTERNS = [
  /^#+\s*/,
  /^[-*]\s*$/,
  /^目录$/,
  /^table of contents$/i,
  /^第?\d+\s*页$/,
  /^page\s*\d+$/i
];

function cleanLine(value: string) {
  return value
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-*•]\s*/, '')
    .trim();
}

function sentenceLength(value: string) {
  return value.replace(/\s/g, '').length;
}

function splitRawLines(raw: string) {
  return raw
    .split(/\n+/)
    .map(cleanLine)
    .filter((line) => line && sentenceLength(line) >= 8)
    .filter((line) => !LOW_VALUE_PATTERNS.some((pattern) => pattern.test(line)));
}

function splitSentences(raw: string) {
  return raw
    .replace(/\r/g, '\n')
    .split(/(?<=[。！？!?；;])\s*|\n+/)
    .map(cleanLine)
    .filter((line) => sentenceLength(line) >= 10)
    .filter((line) => !LOW_VALUE_PATTERNS.some((pattern) => pattern.test(line)));
}

function dedupeLines(lines: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const key = line.slice(0, 42);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}

function clip(value: string, maxLength: number) {
  const text = cleanLine(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function extractJsonObject(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || raw;
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Script response did not contain a JSON object');
  }
  return JSON.parse(source.slice(start, end + 1));
}

function containsAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.toLowerCase().includes(keyword.toLowerCase()));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function topicKeywords(topic: Topic, tutorial: Tutorial) {
  return dedupeLines([
    topic.title,
    topic.painPoint,
    topic.angle,
    topic.hookType,
    ...tutorial.tools,
    ...tutorial.methods,
    ...tutorial.scenarios,
    ...tutorial.targetAudience
  ].flatMap((item) => cleanLine(item).split(/[，,、：: /]+/)))
    .filter((item) => item.length >= 2)
    .slice(0, 18);
}

function estimateScriptProfile(tutorial: Tutorial) {
  const rawLength = sentenceLength(tutorial.rawContent);
  const stepCount = Math.max(tutorial.steps.length, splitRawLines(tutorial.rawContent).filter((line) => /步骤|流程|操作|点击|选择|输入|上传|导入|生成|设置|检查|确认/.test(line)).length);
  const evidenceLimit = clamp(Math.ceil(rawLength / 120) + stepCount, 8, 32);
  const targetScriptChars = clamp(Math.round(rawLength * 0.82) + stepCount * 90, 900, 5200);
  const estimatedSeconds = clamp(Math.round(targetScriptChars / 4.2), 75, 760);
  return {
    evidenceLimit,
    targetScriptChars,
    duration: formatDuration(estimatedSeconds),
    style: `文档讲解脚本，根据原文约 ${rawLength} 字、${stepCount} 个步骤自动生成，重点保证逻辑完整和内容覆盖。`
  };
}

function formatDuration(seconds: number) {
  if (seconds < 120) return `约 ${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `约 ${minutes} 分 ${rest} 秒` : `约 ${minutes} 分钟`;
}

function extractEvidence(topic: Topic, tutorial: Tutorial, limit: number) {
  const keywords = topicKeywords(topic, tutorial);
  const lines = dedupeLines([...splitRawLines(tutorial.rawContent), ...splitSentences(tutorial.rawContent)])
    .filter((line) => cleanLine(line) !== cleanLine(tutorial.title))
    .filter((line) => !isMetadataLine(line, tutorial));
  const scored = lines.map((line, index) => {
    let score = 0;
    if (containsAny(line, keywords)) score += 8;
    if (/^\d+[.、]/.test(line) || /^第[一二三四五六七八九十]+/.test(line)) score += 6;
    if (containsAny(line, ['步骤', '方法', '流程', '操作', '生成', '设置', '选择', '输入', '导入', '输出'])) score += 5;
    if (containsAny(line, ['注意', '不要', '不能', '避免', '风险', '问题', '失败'])) score += 4;
    if (sentenceLength(line) >= 18 && sentenceLength(line) <= 140) score += 3;
    if (index < 20) score += 1;
    return { line, score, index };
  });

  const selected = scored
    .filter((item) => item.score >= 3)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.line);

  const fallback = lines.slice(0, limit);
  return dedupeLines(selected.length >= 3 ? selected : fallback).slice(0, limit);
}

function isMetadataLine(value: string, tutorial: Tutorial) {
  const text = cleanLine(value);
  const title = normalizeTitleSeed(tutorial.title);
  if (!text) return true;
  if (/知兔AI|来源[:：]|整理|^标题[:：]/.test(text)) return true;
  return normalizeTitleSeed(text) === title;
}

function meaningfulSummary(tutorial: Tutorial, evidence: string[]) {
  const summary = cleanLine(tutorial.summary);
  if (summary && !isMetadataLine(summary, tutorial) && normalizeTitleSeed(summary) !== normalizeTitleSeed(tutorial.title)) {
    return summary;
  }
  return evidence.find((item) => !isMetadataLine(item, tutorial)) || '';
}

function problemStatement(tutorial: Tutorial, evidence: string[], subject: string, outcome: string) {
  const candidates = [
    ...tutorial.keyQuotes,
    ...tutorial.risks,
    ...evidence,
    tutorial.summary
  ]
    .map(cleanLine)
    .filter((item) => item && !isMetadataLine(item, tutorial))
    .filter((item) => /困境|问题|痛点|无法|低效|散落|难|不会|麻烦|耗时|容易/.test(item))
    .filter((item) => !/[：:]$/.test(item));

  const direct = candidates.find((item) => sentenceLength(item) >= 14 && sentenceLength(item) <= 120);
  if (direct) return direct;

  if (outcome) return `把《${subject}》这件事从零散操作变成一套能复现的${outcome}`;
  return `把《${subject}》里的关键流程讲清楚，让用户照着步骤就能复现`;
}

function describeStepVoiceover(text: string) {
  const clean = cleanProfessionalLine(text);
  if (/资料库|表格|字段|看板/.test(clean)) {
    return `${clip(clean, 110)}。先把底层结构搭好，后面的记录、关联和自动化才有稳定的承载位置。`;
  }
  if (/关联|跟进|记录/.test(clean)) {
    return `${clip(clean, 110)}。这样每一次沟通都能回到同一个客户档案里，避免信息散在聊天记录和个人备忘里。`;
  }
  if (/表单|录入|语音/.test(clean)) {
    return `${clip(clean, 110)}。这个入口负责降低录入成本，让一线人员能更快把客户信息补进系统。`;
  }
  if (/自动化|机器人|工作流/.test(clean)) {
    return `${clip(clean, 110)}。它负责把重复动作交给系统处理，让客户信息从收集到整理形成闭环。`;
  }
  return `${clip(clean, 120)}。这里要讲清楚它在整套流程里的作用，以及用户完成后会得到什么。`;
}

function riskTitle(value: string) {
  return clip(cleanProfessionalLine(value)
    .replace(/^此时[，,：:\s]*/, '')
    .replace(/^这里要特别说明一个大家未来很可能会遇到的情况[。；;，,：:\s]*/, '')
    .split(/[。；;]/)[0], 24) || '需要提前检查的限制';
}

function describeRiskVoiceover(value: string) {
  const text = clip(value, 130);
  return `${text}。这一点要提前确认，否则流程看起来已经完成，实际结果还可能需要人工校验。`;
}

function normalizeStepTitle(value: string, index: number) {
  return cleanLine(value)
    .replace(/^\d+[.、]\s*/, '')
    .replace(/^第[一二三四五六七八九十]+[步点、：:\s]*/, '')
    .replace(/^[，,。:：、\s]+/, '')
    || `步骤 ${index + 1}`;
}

function buildSteps(tutorial: Tutorial, evidence: string[]) {
  const parsedSteps = tutorial.steps.map((step, index) => {
    const title = normalizeStepTitle(step.title, index);
    const detail = cleanLine(step.detail || '');
    return detail && detail !== title ? `${title}：${detail}` : title;
  }).filter(isUsefulStepLine);

  if (parsedSteps.length >= 3) return dedupeStepLines(parsedSteps).slice(0, 10);

  return dedupeStepLines(evidence
    .filter((line) => containsAny(line, ['步骤', '方法', '流程', '操作', '生成', '设置', '选择', '输入', '导入', '输出']) || /^\d+[.、]/.test(line))
    .map((line, index) => normalizeStepTitle(line, index))
    .filter(isUsefulStepLine))
    .slice(0, 10);
}

function isUsefulStepLine(value: string) {
  const text = cleanLine(value);
  if (sentenceLength(text) < 6) return false;
  if (/^(个字段|字段，|点击确定|来源[:：])/.test(text)) return false;
  if (/^第?\d+\s*页/.test(text)) return false;
  return true;
}

function dedupeStepLines(lines: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const normalized = cleanLine(line)
      .replace(/^第[一二三四五六七八九十\d]+步[：:\s]*/, '')
      .replace(/^\d+[.、]\s*/, '')
      .replace(/^(先打地基|实时跟进|打造高效入口|配置自动化)[，,：:\s]*/, '')
      .replace(/[，,。；;：:].*$/, '')
      .slice(0, 22);
    if ([...seen].some((key) => key.includes(normalized) || normalized.includes(key))) continue;
    seen.add(normalized);
    result.push(line);
  }
  return result;
}

function isRealRiskLine(value: string) {
  const text = cleanLine(value);
  if (sentenceLength(text) < 10) return false;
  if (/点击确定|奇妙的事情发生了|自动跳转|多了一列/.test(text)) return false;
  return /不能|不要|避免|风险|失败|校验|特别说明|必须|注意.*(不是|不能|不要|必须|情况|限制|英文)/.test(text);
}

function usefulKeyQuotes(tutorial: Tutorial) {
  return tutorial.keyQuotes
    .map(cleanLine)
    .filter((item) => item && item !== tutorial.title)
    .filter((item) => !/知兔AI|来源[:：]|整理|^\d+[.、]/.test(item))
    .filter((item, index, arr) => arr.findIndex((candidate) => normalizeTitleSeed(candidate) === normalizeTitleSeed(item)) === index)
    .slice(0, 3);
}

function buildHook(topic: Topic, tutorial: Tutorial, evidence: string[]) {
  const subject = titleSubject(tutorial, evidence);
  const outcome = titleOutcome(tutorial, evidence);
  const firstEvidence = problemStatement(tutorial, evidence, subject, outcome);
  return `这条视频讲清楚《${clip(subject, 28)}》怎么做。先把问题说清，再按文档拆步骤，最后提醒容易出错的地方。核心问题是：${clip(firstEvidence, 70)}`;
}

function cleanProfessionalLine(value: string) {
  return cleanLine(value)
    .replace(/^第\s*\d+\s*步[：:\s]*/g, '')
    .replace(/^步骤\s*\d+[：:\s]*/g, '')
    .replace(/^关键点\s*\d+[：:\s]*/g, '')
    .replace(/^关键字幕[：:\s]*/g, '')
    .replace(/^最后收束[：:\s]*/g, '')
    .replace(/^补充说明\s*\d*[：:\s]*/g, '')
    .trim();
}

function normalizeTitleSeed(value: string) {
  return cleanLine(value)
    .replace(/\.(docx|txt|md|html)$/i, '')
    .replace(/\s+-\s*知兔AI$/i, '')
    .replace(/知兔AI/g, '')
    .replace(/^如何用AI/, '')
    .replace(/^如何/, '')
    .replace(/^用[^，,、]{1,12}搞定/, '')
    .replace(/[？?。！!]+$/g, '')
    .replace(/^[：:，,、\s]+/, '')
    .trim();
}

function titleSubject(tutorial: Tutorial, evidence: string[]) {
  const titleSeed = normalizeTitleSeed(tutorial.title);
  if (titleSeed.length >= 6) return clip(titleSeed, 28);

  const sourceCandidates = [
    tutorial.summary,
    ...tutorial.steps.map((step) => [step.title, step.detail].filter(Boolean).join('：')),
    ...evidence
  ]
    .map(normalizeTitleSeed)
    .filter((item) => item.length >= 4)
    .filter((item) => !/^第[一二三四五六七八九十\d]+/.test(item));

  const actionCandidate = sourceCandidates.find((item) => /生成|制作|搭建|创建|配置|设计|分析|整理|输出|上传|导入/.test(item));
  return clip(actionCandidate || sourceCandidates[0] || '把文档内容做成讲解视频', 26);
}

function titleOutcome(tutorial: Tutorial, evidence: string[]) {
  const titleText = cleanLine(tutorial.title);
  if (/客情|客户/.test(titleText)) return '客户管理流程';
  if (/爆款内容|内容拆解/.test(titleText)) return '爆款内容拆解表';
  if (/项目管理|任务管理|进度/.test(titleText)) return '项目管理看板';
  if (/证书|发放/.test(titleText)) return '证书批量发放流程';
  if (/写文案|文案/.test(titleText)) return '文案生成流程';
  if (/教案/.test(titleText)) return '完整教案';
  if (/试卷|题目|选择题|填空题|判断题|简答题/.test(titleText)) return '可用试卷';
  if (/PPT|演示|汇报|答辩/.test(titleText)) return '演示材料';
  if (/客服|售后|助手|智能体/.test(titleText)) return '智能助手';
  if (/音乐|歌曲|歌词/.test(titleText)) return '音乐作品';
  if (/绘本|故事|图片|海报/.test(titleText)) return '创意内容';

  const pool = [
    tutorial.title,
    tutorial.summary,
    ...tutorial.steps.map((step) => `${step.title} ${step.detail}`),
    ...evidence
  ].map(cleanLine);

  if (pool.some((item) => /客情|客户/.test(item))) return '客户管理流程';
  if (pool.some((item) => /爆款内容|内容拆解/.test(item))) return '爆款内容拆解表';
  if (pool.some((item) => /项目管理|任务管理|进度/.test(item))) return '项目管理看板';
  if (pool.some((item) => /证书|发放/.test(item))) return '证书批量发放流程';
  if (pool.some((item) => /写文案|文案/.test(item))) return '文案生成流程';
  if (pool.some((item) => /教案/.test(item))) return '完整教案';
  if (pool.some((item) => /试卷|题目|选择题|填空题|判断题|简答题/.test(item))) return '可用试卷';
  if (pool.some((item) => /PPT|演示|汇报|答辩/.test(item))) return '演示材料';
  if (pool.some((item) => /客服|售后|助手|智能体/.test(item))) return '智能助手';
  if (pool.some((item) => /报表|数据|表格|分析/.test(item))) return '分析报表';
  if (pool.some((item) => /音乐|歌曲|歌词/.test(item))) return '音乐作品';
  if (pool.some((item) => /绘本|故事|图片|海报/.test(item))) return '创意内容';
  return '';
}

function titleAction(tutorial: Tutorial, evidence: string[]) {
  const text = [tutorial.rawContent, tutorial.summary, ...evidence].join('\n');
  if (tutorial.steps.length >= 3) return `${tutorial.steps.length}步`;
  if (/上传|导入|文件|文档/.test(text)) return '上传文档后';
  if (/搭建|创建|配置|节点|工作流/.test(text)) return '搭好流程后';
  if (/提示词|指令|输入/.test(text)) return '写对提示词后';
  if (/分析|总结|提取|整理/.test(text)) return '整理内容后';
  return '';
}

function buildScriptTitle(topic: Topic, tutorial: Tutorial, evidence: string[]) {
  const subject = titleSubject(tutorial, evidence);
  const outcome = titleOutcome(tutorial, evidence);
  const action = titleAction(tutorial, evidence);
  const tool = tutorial.tools[0];
  const audience = tutorial.targetAudience[0];
  const risk = tutorial.risks[0] ? clip(normalizeTitleSeed(tutorial.risks[0]), 18) : '';
  const subjectHasTool = Boolean(tool && subject.includes(tool));

  const candidates = [
    outcome && action ? `${subject}：${action}拆清${outcome}` : '',
    outcome ? `${subject}：从文档到${outcome}` : '',
    tool && outcome && !subjectHasTool ? `${tool}怎么做${outcome}` : '',
    audience ? `${audience}做${subject}，先确认这几个步骤` : '',
    risk ? `${subject}最容易忽略的关键步骤` : '',
    subject ? `${subject}，按这套流程做更稳` : '',
    normalizeTitleSeed(topic.title)
  ].map((item) => clip(item, 34)).filter((item) => item.length >= 6);

  return candidates[0] || '根据文档自动生成讲解视频脚本';
}

function buildBody(topic: Topic, tutorial: Tutorial, profile: ReturnType<typeof estimateScriptProfile>) {
  const evidence = extractEvidence(topic, tutorial, profile.evidenceLimit);
  const steps = buildSteps(tutorial, evidence);
  const subject = titleSubject(tutorial, evidence);
  const outcome = titleOutcome(tutorial, evidence);
  const lines: string[] = [];

  const firstProblem = problemStatement(tutorial, evidence, subject, outcome);
  lines.push(`1. 先交代目标：这条内容要解决的是“${clip(firstProblem, 72)}”。观众需要先知道为什么要做《${clip(subject, 24)}》，以及做完之后能得到什么${outcome ? `，也就是${outcome}` : ''}。`);

  const contextParts = [
    tutorial.tools.length ? `会用到${tutorial.tools.slice(0, 4).join('、')}` : '',
    tutorial.methods.length ? `核心方法是${tutorial.methods.slice(0, 3).join('、')}` : '',
    tutorial.scenarios.length ? `主要适用于${tutorial.scenarios.slice(0, 3).join('、')}` : '',
    tutorial.targetAudience.length ? `面向${tutorial.targetAudience.slice(0, 3).join('、')}` : ''
  ].filter(Boolean);
  if (contextParts.length) {
    lines.push(`2. 再说明准备条件：${contextParts.join('；')}。这一镜头的作用是让观众明确工具、场景和使用边界，不要一上来就直接跳操作。`);
  }

  const coreSteps = steps.length ? steps : evidence.slice(0, 8).map((item, index) => `关键点 ${index + 1}：${item}`);
  coreSteps.slice(0, 18).forEach((step, index) => {
    const order = lines.length + 1;
    const normalized = normalizeStepTitle(step, index);
    const focus = /注意|不要|不能|风险|失败|校验|确认/.test(normalized)
      ? '这一镜头要强调限制条件和检查动作。'
      : /点击|选择|输入|上传|导入|设置|配置|打开|保存/.test(normalized)
        ? '这一镜头要把具体操作顺序讲清楚。'
        : '这一镜头要讲清楚它在整体流程中的作用。';
    lines.push(`${order}. 第${index + 1}步：${clip(normalized, 105)}。${focus}`);
  });

  const riskLines = (tutorial.risks.length ? tutorial.risks : evidence).filter(isRealRiskLine);
  riskLines.slice(0, 2).forEach((risk) => {
    const order = lines.length + 1;
    lines.push(`${order}. 风险提醒：${clip(risk, 110)}。这一镜头放在结尾前，提醒用户哪些地方必须检查，避免只照着步骤做却忽略限制。`);
  });

  const quotes = usefulKeyQuotes(tutorial);
  if (quotes.length) {
    const order = lines.length + 1;
    lines.push(`${order}. 关键字幕：${quotes.map((item) => `“${clip(item, 42)}”`).join('、')}。这些句子适合放在画面上，帮助观众记住最核心的信息。`);
  }

  return lines.join('\n');
}

function naturalCta(topic: Topic, tutorial: Tutorial, evidence: string[]) {
  const subject = titleSubject(tutorial, evidence);
  const outcome = titleOutcome(tutorial, evidence);
  const audience = tutorial.targetAudience[0] || topic.audience || '你';
  const nextAction = outcome
    ? `先按这套流程做出一个可检查的${outcome}`
    : '先按这套流程跑通一遍，再根据自己的场景微调';
  return `如果${audience}也要处理《${clip(subject, 24)}》，建议从最小的一组素材开始，${nextAction}。跑通以后，再把步骤、提示词和检查项沉淀成自己的固定模板。`;
}

function buildDirectorPrompt(topic: Topic, tutorial: Tutorial, evidence: string[], profile: ReturnType<typeof estimateScriptProfile>) {
  const sourceBlocks = [
    `文档标题：${tutorial.title}`,
    tutorial.summary ? `文档摘要：${tutorial.summary}` : '',
    tutorial.tools.length ? `工具：${tutorial.tools.join('、')}` : '',
    tutorial.targetAudience.length ? `受众：${tutorial.targetAudience.join('、')}` : '',
    tutorial.scenarios.length ? `场景：${tutorial.scenarios.join('、')}` : '',
    tutorial.steps.length ? `解析到的步骤：\n${tutorial.steps.slice(0, 16).map((step, index) => `${index + 1}. ${[step.title, step.detail].filter(Boolean).join('：')}`).join('\n')}` : '',
    evidence.length ? `原文依据：\n${evidence.slice(0, 18).map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '',
    tutorial.risks.length ? `风险/注意：\n${tutorial.risks.slice(0, 8).map((item, index) => `${index + 1}. ${item}`).join('\n')}` : '',
    `期望时长：${profile.duration}`
  ].filter(Boolean).join('\n\n');

  const systemPrompt = [
    '你是一位资深中文视频分镜导演和商业教育类视频编导，专门把文档改写成专业、清晰、可拍摄的讲解视频脚本。',
    '你的目标不是总结文档，而是设计一条用户可以确认并直接生成视频的镜头脚本。',
    '必须遵守：',
    '1. 只输出 JSON，不要 Markdown，不要解释。',
    '2. 按文档真实内容写，不要编造文档没有的功能、平台、结果。',
    '3. 不要出现“关键点”“第几步”“步骤一”“关键字幕”“最后收束”“补充说明”等机械标签。',
    '4. 每个镜头必须是一个自然的口播段落，像专业讲解视频的旁白，不要像大纲。',
    '5. 镜头标题要短、明确、能概括这一镜头的画面任务。',
    '6. 每个 voiceover 控制在 60 到 220 个汉字；信息多就拆成更多镜头，不要删掉关键条件、参数、限制和操作细节。',
    '7. 镜头数量根据内容决定，短文不少于 8 个，中等文档 12 到 20 个，长文可以 20 到 36 个；不要强行压成 4 到 6 个。',
    '8. 开场镜头直接说明用户问题和视频收益，不要空泛营销。',
    '9. 中间镜头按因果和操作顺序展开，避免重复同一句、重复同一动作。',
    '10. 风险提醒只能写真正的限制、校验、容易失败的地方；没有就不要硬写。',
    '11. 结尾只做自然行动引导，不要写“最后收束”“结尾行动”“确认镜头”“生成视频”这类制作系统内部话术。',
    '12. visualPrompt 要告诉画面如何呈现，比如流程图、表格字段、高亮操作、对比卡片、风险提示卡，不要只复述旁白。',
    '13. hook 是开场口播，cta 是结尾口播，shots 只放中间主体镜头，不要把开场和结尾重复放进 shots。',
    '14. cta 必须面向观众下一步怎么实践本文档内容，不能面向视频制作人员。',
    '输出格式必须是：{"title":"...","hook":"...","shots":[{"title":"...","voiceover":"...","visualPrompt":"..."}],"cta":"..."}'
  ].join('\n');

  const userPrompt = [
    '请把下面文档信息改写成专业视频分镜脚本。',
    '注意：shots 是用户确认视频前看到的核心内容，必须专业、顺滑、能直接进入生成。',
    '',
    sourceBlocks
  ].join('\n');

  return { systemPrompt, userPrompt };
}

function normalizeProfessionalDraft(raw: unknown, fallbackTitle: string): ProfessionalScriptDraft | null {
  const value = raw as Partial<ProfessionalScriptDraft> | null;
  if (!value || typeof value !== 'object' || !Array.isArray(value.shots)) return null;
  const shots = value.shots
    .map((shot) => ({
      title: cleanProfessionalLine(String((shot as ProfessionalShot).title || '')),
      voiceover: cleanProfessionalLine(String((shot as ProfessionalShot).voiceover || '')),
      visualPrompt: cleanLine(String((shot as ProfessionalShot).visualPrompt || ''))
    }))
    .filter((shot) => sentenceLength(shot.title) >= 2 && sentenceLength(shot.voiceover) >= 18)
    .filter((shot) => !/关键字幕|最后收束|补充说明|关键点|第\d+步/.test(`${shot.title}${shot.voiceover}`))
    .slice(0, 36);

  if (shots.length < 6) return null;
  return {
    title: clip(cleanProfessionalLine(String(value.title || fallbackTitle)), 38) || fallbackTitle,
    hook: cleanProfessionalLine(String(value.hook || shots[0].voiceover)),
    shots,
    cta: cleanProfessionalLine(String(value.cta || ''))
  };
}

function draftToBody(draft: ProfessionalScriptDraft) {
  return draft.shots.map((shot, index) => `${index + 1}. ${shot.title}：${shot.voiceover}`).join('\n');
}

function fallbackProfessionalDraft(topic: Topic, tutorial: Tutorial, evidence: string[], profile: ReturnType<typeof estimateScriptProfile>): ProfessionalScriptDraft {
  const title = buildScriptTitle(topic, tutorial, evidence);
  const subject = titleSubject(tutorial, evidence);
  const outcome = titleOutcome(tutorial, evidence);
  const steps = buildSteps(tutorial, evidence);
  const introProblem = problemStatement(tutorial, evidence, subject, outcome);
  const hook = `这条视频讲清楚《${clip(subject, 26)}》怎么做。先看它解决的核心问题：${clip(introProblem, 78)}。`;
  const shots: ProfessionalShot[] = [];
  if (tutorial.tools.length || tutorial.targetAudience.length || tutorial.scenarios.length) {
    shots.push({
      title: '交代工具和适用场景',
      voiceover: [
        tutorial.tools.length ? `这套流程主要会用到${tutorial.tools.slice(0, 4).join('、')}` : '',
        tutorial.targetAudience.length ? `适合${tutorial.targetAudience.slice(0, 3).join('、')}` : '',
        tutorial.scenarios.length ? `常用在${tutorial.scenarios.slice(0, 3).join('、')}` : ''
      ].filter(Boolean).join('，') + '。先把使用边界说清楚，后面的操作才不会混乱。',
      visualPrompt: '工具、角色、场景三列卡片，突出使用边界'
    });
  }
  steps.slice(0, 18).forEach((step) => {
    const text = cleanProfessionalLine(normalizeStepTitle(step, shots.length));
    shots.push({
      title: clip(text.split(/[。；;，,]/)[0], 22),
      voiceover: describeStepVoiceover(text),
      visualPrompt: `流程节点画面，高亮当前动作：${clip(text, 70)}`
    });
  });
  (tutorial.risks.length ? tutorial.risks : evidence.filter(isRealRiskLine)).filter(isRealRiskLine).slice(0, 2).forEach((risk) => {
    shots.push({
      title: riskTitle(risk),
      voiceover: describeRiskVoiceover(risk),
      visualPrompt: `风险提示卡，列出需要检查的限制条件：${clip(risk, 70)}`
    });
  });
  const used = new Set(shots.map((shot) => normalizeTitleSeed(shot.voiceover).slice(0, 28)));
  for (const item of evidence) {
    if (shots.length >= 24) break;
    const text = cleanProfessionalLine(item);
    const key = normalizeTitleSeed(text).slice(0, 28);
    if (!text || used.has(key) || sentenceLength(text) < 14) continue;
    used.add(key);
    shots.push({
      title: clip(text.split(/[。；;，,]/)[0], 22),
      voiceover: `${clip(text, 150)}。这一段要保留原文里的关键判断，让观众知道为什么要这么做，而不是只看到一个操作结果。`,
      visualPrompt: `信息卡或流程节点，突出原文关键句：${clip(text, 70)}`
    });
  }
  const cta = naturalCta(topic, tutorial, evidence);
  return { title, hook, shots: shots.slice(0, 28), cta };
}

async function generateProfessionalDraft(topic: Topic, tutorial: Tutorial, evidence: string[], profile: ReturnType<typeof estimateScriptProfile>) {
  const fallbackTitle = buildScriptTitle(topic, tutorial, evidence);
  if (!isMiniMaxConfigured()) {
    return fallbackProfessionalDraft(topic, tutorial, evidence, profile);
  }

  try {
    const { systemPrompt, userPrompt } = buildDirectorPrompt(topic, tutorial, evidence, profile);
    const generated = await generateTextWithMiniMax({
      systemPrompt,
      userPrompt,
      temperature: 0.28,
      maxTokens: 8000
    });
    if (!generated?.text) return fallbackProfessionalDraft(topic, tutorial, evidence, profile);
    const parsed = extractJsonObject(generated.text);
    const normalized = normalizeProfessionalDraft(parsed, fallbackTitle);
    if (!normalized) return fallbackProfessionalDraft(topic, tutorial, evidence, profile);
    return {
      ...normalized,
      cta: /确认.*镜头|生成视频|成片出来|结尾行动|最后收束/.test(normalized.cta)
        ? naturalCta(topic, tutorial, evidence)
        : normalized.cta || naturalCta(topic, tutorial, evidence)
    };
  } catch (error) {
    console.warn('Professional script generation failed; using fallback script', error instanceof Error ? error.message : String(error));
    return fallbackProfessionalDraft(topic, tutorial, evidence, profile);
  }
}

export async function generateScripts(topic: Topic, tutorial: Tutorial): Promise<Script[]> {
  const profile = estimateScriptProfile(tutorial);
  const evidence = extractEvidence(topic, tutorial, profile.evidenceLimit);
  const draft = await generateProfessionalDraft(topic, tutorial, evidence, profile);
  const body = draftToBody(draft);

  return [{
    id: simpleId('script'),
    topicId: topic.id,
    tutorialId: tutorial.id,
    platform: 'document',
    duration: profile.duration,
    title: draft.title,
    hook: draft.hook,
    body,
    cta: draft.cta,
    style: `${profile.style}；由专业视频分镜专家提示词生成，镜头需人工确认后再进入视频制作。`,
    createdAt: nowIso(),
    version: 1,
    sourceScriptId: undefined
  }];
}
