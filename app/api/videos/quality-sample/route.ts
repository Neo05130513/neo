import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { runAutoQualitySampling } from '@/lib/quality';

export async function POST(request: Request) {
  const auth = await requireApiRole(['ops']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const sampleSize = typeof body.sampleSize === 'number' ? Math.max(1, Math.min(10, Math.floor(body.sampleSize))) : 3;
    const round = typeof body.round === 'string' && body.round.trim() ? body.round.trim() : undefined;

    const result = await runAutoQualitySampling(sampleSize, round);
    await Promise.all((result.reviews || []).map((review: { projectId: string; round: string }) => appendAuditLog({
      actor: auth.user,
      action: 'quality.sample.run',
      targetType: 'video_project',
      targetId: review.projectId,
      summary: `执行抽样质检：${review.round}`
    })));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'quality sampling failed' },
      { status: 500 }
    );
  }
}
