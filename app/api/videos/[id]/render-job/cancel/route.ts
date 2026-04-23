import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { cancelRenderJob } from '@/lib/render-jobs';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole(['content', 'video']);
  if (!auth.ok) return auth.response;

  try {
    const job = await cancelRenderJob(params.id);
    await appendAuditLog({
      actor: auth.user,
      action: 'video_project.render.cancel',
      targetType: 'video_project',
      targetId: params.id,
      summary: `停止视频生成：${params.id}`
    });
    return NextResponse.json({ ok: true, job });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel render job' },
      { status: 500 }
    );
  }
}
