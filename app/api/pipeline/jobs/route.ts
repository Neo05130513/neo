import { NextResponse } from 'next/server';
import { enqueuePipelineJob } from '@/lib/pipeline-jobs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tutorialId = body.tutorialId as string | undefined;
    if (!tutorialId) {
      return NextResponse.json({ error: 'tutorialId is required' }, { status: 400 });
    }

    const job = await enqueuePipelineJob(tutorialId);
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建教程处理任务失败' },
      { status: 500 }
    );
  }
}
