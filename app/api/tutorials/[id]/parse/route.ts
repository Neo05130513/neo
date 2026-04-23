import { NextResponse } from 'next/server';
import { parseTutorial } from '@/lib/parser';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { readJsonFile, writeJsonFile } from '@/lib/storage';
import { Tutorial } from '@/lib/types';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(['content']);
  if (!auth.ok) return auth.response;

  const tutorials = await readJsonFile<Tutorial[]>('data/tutorials.json');
  const tutorialIndex = tutorials.findIndex((item) => item.id === params.id);

  if (tutorialIndex === -1) {
    return NextResponse.json({ error: 'Tutorial not found' }, { status: 404 });
  }

  const parsed = parseTutorial(tutorials[tutorialIndex]);
  tutorials[tutorialIndex] = parsed;
  await writeJsonFile('data/tutorials.json', tutorials);
  await appendAuditLog({
    actor: auth.user,
    action: 'tutorial.parse',
    targetType: 'tutorial',
    targetId: parsed.id,
    summary: `解析教程：${parsed.title}`
  });

  return NextResponse.json({ tutorial: parsed });
}
