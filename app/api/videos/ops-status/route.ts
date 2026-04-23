import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { updateVideoProjectsOpsStatus } from '@/lib/videos';
import type { VideoOpsStatus } from '@/lib/types';

const allowedOpsStatuses: VideoOpsStatus[] = ['idle', 'queued_publish', 'reviewed', 'queued_rework'];

export async function POST(request: Request) {
  const auth = await requireApiRole(['ops']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const projectIds = body.projectIds as string[] | undefined;
    const opsStatus = body.opsStatus as VideoOpsStatus | undefined;

    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: 'projectIds is required' }, { status: 400 });
    }

    if (!opsStatus || !allowedOpsStatuses.includes(opsStatus)) {
      return NextResponse.json({ error: 'opsStatus is invalid' }, { status: 400 });
    }

    const result = await updateVideoProjectsOpsStatus(projectIds, opsStatus);
    await Promise.all(projectIds.map((projectId) => appendAuditLog({
      actor: auth.user,
      action: 'video_project.ops_status.update',
      targetType: 'video_project',
      targetId: projectId,
      summary: `更新运营状态为 ${opsStatus}`
    })));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update video project ops status' },
      { status: 500 }
    );
  }
}
