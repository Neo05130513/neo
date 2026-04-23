import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { deleteVideoProject } from '@/lib/videos';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole(['content', 'video']);
  if (!auth.ok) return auth.response;

  try {
    const result = await deleteVideoProject(params.id);
    await appendAuditLog({
      actor: auth.user,
      action: 'video_project.delete',
      targetType: 'video_project',
      targetId: params.id,
      summary: `删除视频项目：${result.project.title}`
    });
    return NextResponse.json({ ok: true, project: result.project });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete video project' },
      { status: 500 }
    );
  }
}
