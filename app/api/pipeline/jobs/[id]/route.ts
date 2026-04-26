import { NextResponse } from 'next/server';
import { cancelPipelineJob, getPipelineJob } from '@/lib/pipeline-jobs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const job = await getPipelineJob(params.id);
  if (!job) {
    return NextResponse.json({ error: 'Pipeline job not found' }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action !== 'cancel') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    const job = await cancelPipelineJob(params.id);
    if (!job) {
      return NextResponse.json({ error: 'Pipeline job not found' }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '取消脚本任务失败' },
      { status: 500 }
    );
  }
}
