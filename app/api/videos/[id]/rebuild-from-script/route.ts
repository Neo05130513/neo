import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { regenerateStoryboardFromScript } from '@/lib/videos';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(['video']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const scriptId = body.scriptId as string | undefined;

    if (!scriptId) {
      return NextResponse.json({ error: 'scriptId is required' }, { status: 400 });
    }

    const result = await regenerateStoryboardFromScript(params.id, scriptId);
    await appendAuditLog({
      actor: auth.user,
      action: 'video_project.rebuild_from_script',
      targetType: 'video_project',
      targetId: params.id,
      summary: `按脚本版本重建项目：${result.project.title}`
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to rebuild project from script' },
      { status: 500 }
    );
  }
}
