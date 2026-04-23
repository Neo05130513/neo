import { nowIso, readJsonFile, simpleId, writeJsonFile } from './storage';
import type { Script } from './types';

export async function updateScriptContent(scriptId: string, updates: Pick<Script, 'title' | 'hook' | 'body' | 'cta' | 'style'>) {
  const scripts = await readJsonFile<Script[]>('data/scripts.json');
  const index = scripts.findIndex((item) => item.id === scriptId);
  if (index === -1) {
    throw new Error('Script not found');
  }

  const current = scripts[index];
  const next: Script = {
    ...current,
    title: updates.title,
    hook: updates.hook,
    body: updates.body,
    cta: updates.cta,
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

export function buildScriptExportText(script: Script) {
  return [
    `标题：${script.title}`,
    `时长：${script.duration}`,
    `风格：${script.style}`,
    `版本：v${script.version || 1}`,
    '',
    '【开头 Hook】',
    script.hook,
    '',
    '【正文】',
    script.body,
    '',
    '【结尾 CTA】',
    script.cta,
    ''
  ].join('\n');
}
