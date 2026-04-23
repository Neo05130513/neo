import { readJsonFile } from './storage';
import type { Script } from './types';

export async function getScriptVersionFamily(scriptId: string) {
  const scripts = await readJsonFile<Script[]>('data/scripts.json');
  const current = scripts.find((item) => item.id === scriptId);
  if (!current) {
    throw new Error('Script not found');
  }

  const familyId = current.sourceScriptId || current.id;
  const family = scripts
    .filter((item) => (item.sourceScriptId || item.id) === familyId || item.id === familyId)
    .sort((a, b) => (a.version || 1) - (b.version || 1));

  return { current, family, familyId };
}

export function buildScriptDiff(base: Script, target: Script) {
  return {
    titleChanged: base.title !== target.title,
    hookChanged: base.hook !== target.hook,
    bodyChanged: base.body !== target.body,
    ctaChanged: base.cta !== target.cta,
    styleChanged: base.style !== target.style,
    base,
    target
  };
}
