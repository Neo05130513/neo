import { NextResponse } from 'next/server';
import { generateTopics } from '@/lib/topics';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { readJsonFile, writeJsonFile } from '@/lib/storage';
import { Topic, Tutorial } from '@/lib/types';

export async function POST(request: Request) {
  const auth = await requireApiRole(['content']);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const tutorialId = body.tutorialId as string;
  const tutorials = await readJsonFile<Tutorial[]>('data/tutorials.json');
  const topics = await readJsonFile<Topic[]>('data/topics.json');
  const tutorial = tutorials.find((item) => item.id === tutorialId);

  if (!tutorial) {
    return NextResponse.json({ error: 'Tutorial not found' }, { status: 404 });
  }

  const generated = await generateTopics(tutorial);
  const nextTopics = [...generated, ...topics.filter((item) => item.tutorialId !== tutorialId)];
  await writeJsonFile('data/topics.json', nextTopics);
  await appendAuditLog({
    actor: auth.user,
    action: 'topic.generate',
    targetType: 'tutorial',
    targetId: tutorial.id,
    summary: `生成选题 ${generated.length} 条：${tutorial.title}`
  });

  return NextResponse.json({ topics: generated });
}
