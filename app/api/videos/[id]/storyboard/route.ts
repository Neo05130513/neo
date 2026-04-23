import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { regenerateStoryboard } from '@/lib/videos';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireApiRole(['video']);
  if (!auth.ok) return auth.response;

  try {
    const result = await regenerateStoryboard(params.id);
    await appendAuditLog({
      actor: auth.user,
      action: 'video_project.storyboard.regenerate',
      targetType: 'video_project',
      targetId: params.id,
      summary: `重生成分镜：${result.project.title}`
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to regenerate storyboard' },
      { status: 500 }
    );
  }
}
