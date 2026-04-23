import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { enqueueRenderJob } from '@/lib/render-jobs';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole(['content', 'video']);
  if (!auth.ok) return auth.response;

  try {
    const job = await enqueueRenderJob(params.id);
    await appendAuditLog({
      actor: auth.user,
      action: 'video_project.render.enqueue',
      targetType: 'video_project',
      targetId: params.id,
      summary: `提交渲染任务：${params.id}`
    });
    return NextResponse.json({ ok: true, job }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to enqueue render job' },
      { status: 500 }
    );
  }
}
