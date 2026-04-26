import { nowIso, readJsonFile, simpleId, writeJsonFile } from './storage';
import { sanitizeScriptBlock } from './narration';
import type { Script } from './types';

export async function updateScriptContent(scriptId: string, updates: Pick<Script, 'title' | 'hook' | 'body' | 'cta' | 'style'>) {
  const scripts = await readJsonFile<Script[]>('data/scripts.json');
  const index = scripts.findIndex((item) => item.id === scriptId);
  if (index === -1) {
    throw new Error('Script not found');
  }

  const current = scripts[index];
  const sanitizedHook = sanitizeScriptBlock(updates.hook);
  const sanitizedBody = sanitizeScriptBlock(updates.body);
  const sanitizedCta = sanitizeScriptBlock(updates.cta);
  if (!sanitizedHook || !sanitizedBody || !sanitizedCta) {
    throw new Error('脚本净化后为空，请先把镜头文案改成可上屏内容再保存');
  }
  const next: Script = {
    ...current,
    title: updates.title,
    hook: sanitizedHook,
    body: sanitizedBody,
    cta: sanitizedCta,
    style: updates.style
  };

  const nextScripts = [...scripts];
  nextScripts[index] = next;
  await writeJsonFile('data/scripts.json', nextScripts);
  return next;
}

export async function duplicateScriptVersion(scriptId: string) {
  const scripts = await readJsonFile<Script[]>('data/scripts.json');
  const source = scripts.find((item) => item.id === scriptId);
  if (!source) {
    throw new Error('Script not found');
  }

  const familyId = source.sourceScriptId || source.id;
  const sameFamily = scripts.filter((item) => (item.sourceScriptId || item.id) === familyId);
  const nextVersion = Math.max(...sameFamily.map((item) => item.version || 1), 1) + 1;

  const duplicated: Script = {
    ...source,
    id: simpleId('script'),
    createdAt: nowIso(),
    version: nextVersion,
    sourceScriptId: familyId,
    title: `${source.title} v${nextVersion}`
  };

  await writeJsonFile('data/scripts.json', [duplicated, ...scripts]);
  return duplicated;
}

export async function deleteScriptsByIds(scriptIds: string[]) {
  const uniqueIds = Array.from(new Set(scriptIds.filter(Boolean)));
  if (!uniqueIds.length) {
    throw new Error('scriptIds is required');
  }

  const [scripts, projects] = await Promise.all([
    readJsonFile<Script[]>('data/scripts.json'),
    readJsonFile<import('./types').VideoProject[]>('data/video-projects.json')
  ]);

  const idSet = new Set(uniqueIds);
  const matchedScripts = scripts.filter((item) => idSet.has(item.id));
  if (!matchedScripts.length) {
    throw new Error('Scripts not found');
  }

  const blockedScripts = matchedScripts.filter((script) => projects.some((project) => project.scriptId === script.id));
  if (blockedScripts.length) {
    throw new Error(`这些脚本已经关联视频项目，不能删除：${blockedScripts.map((item) => item.title).join('、')}`);
  }

  const nextScripts = scripts.filter((item) => !idSet.has(item.id));
  await writeJsonFile('data/scripts.json', nextScripts);

  return matchedScripts;
}

export function buildScriptExportText(script: Script) {
  return [
    `标题：${script.title}`,
    `时长：${script.duration}`,
    `风格：${script.style}`,
    `版本：v${script.version || 1}`,
    '',
    '【开头 Hook】',
    sanitizeScriptBlock(script.hook),
    '',
    '【正文】',
    sanitizeScriptBlock(script.body),
    '',
    '【结尾 CTA】',
    sanitizeScriptBlock(script.cta),
    ''
  ].join('\n');
}
