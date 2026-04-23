import { NextResponse } from 'next/server';
import { processTutorialPipeline } from '@/lib/pipeline';

export async function POST(request: Request) {
  const body = await request.json();
  const tutorialId = body.tutorialId as string | undefined;
  const tutorialIds = body.tutorialIds as string[] | undefined;

  const targets = tutorialId ? [tutorialId] : Array.isArray(tutorialIds) ? tutorialIds : [];
  if (!targets.length) {
    return NextResponse.json({ error: 'tutorialId or tutorialIds is required' }, { status: 400 });
  }

  const results = [];
  for (const id of targets) {
    results.push(await processTutorialPipeline(id));
  }

  return NextResponse.json({ results });
}
