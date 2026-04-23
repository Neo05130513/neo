import { NextResponse } from 'next/server';
import { processTutorialPipeline } from '@/lib/pipeline';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(['content']);
  if (!auth.ok) return auth.response;

  const result = await processTutorialPipeline(params.id);
  await appendAuditLog({
    actor: auth.user,
    action: 'tutorial.process_pipeline',
    targetType: 'tutorial',
    targetId: result.tutorial.id,
    summary: `执行教程完整流程：${result.tutorial.title}`
  });
  return NextResponse.json(result);
}
