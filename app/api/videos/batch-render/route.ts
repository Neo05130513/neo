import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { enqueueRenderJobs } from '@/lib/render-jobs';

export async function POST(request: Request) {
  const auth = await requireApiRole(['video']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const projectIds = body.projectIds as string[] | undefined;
    const force = Boolean(body.force);

    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: 'projectIds is required' }, { status: 400 });
    }

    const jobs = await enqueueRenderJobs(projectIds, { force });
    await Promise.all(projectIds.map((projectId) => appendAuditLog({
      actor: auth.user,
      action: force ? 'video_project.batch_render.retry' : 'video_project.batch_render.enqueue',
      targetType: 'video_project',
      targetId: projectId,
      summary: `${force ? '重试' : '提交'}批量渲染任务：${projectId}`
    })));
    return NextResponse.json({ ok: true, jobs }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to enqueue batch render jobs' },
      { status: 500 }
    );
  }
}
