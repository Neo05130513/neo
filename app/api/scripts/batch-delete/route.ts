import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { deleteScriptsByIds } from '@/lib/script-ops';

export async function POST(request: Request) {
  const auth = await requireApiRole(['content']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const scriptIds = Array.isArray(body.scriptIds) ? body.scriptIds.map((item: unknown) => String(item || '').trim()).filter(Boolean) : [];
    if (!scriptIds.length) {
      return NextResponse.json({ error: 'scriptIds is required' }, { status: 400 });
    }

    const deletedScripts = await deleteScriptsByIds(scriptIds);
    await Promise.all(deletedScripts.map((script) => appendAuditLog({
      actor: auth.user,
      action: 'script.delete',
      targetType: 'script',
      targetId: script.id,
      summary: `删除脚本：${script.title}`
    })));

    return NextResponse.json({
      deleted: deletedScripts.map((script) => ({ id: script.id, title: script.title })),
      count: deletedScripts.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete scripts';
    const status = /不能删除|required|not found/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
