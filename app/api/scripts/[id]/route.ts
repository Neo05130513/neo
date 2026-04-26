import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { deleteScriptsByIds, updateScriptContent } from '@/lib/script-ops';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(['content']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const title = String(body.title || '').trim();
    const hook = String(body.hook || '').trim();
    const bodyText = String(body.body || '').trim();
    const cta = String(body.cta || '').trim();
    const style = String(body.style || '').trim();

    if (!title || !hook || !bodyText || !cta || !style) {
      return NextResponse.json({ error: 'title, hook, body, cta, style are required' }, { status: 400 });
    }

    const script = await updateScriptContent(params.id, {
      title,
      hook,
      body: bodyText,
      cta,
      style
    });

    await appendAuditLog({
      actor: auth.user,
      action: 'script.update',
      targetType: 'script',
      targetId: script.id,
      summary: `编辑脚本内容：${script.title}`
    });

    return NextResponse.json({ script });
  } catch (error) {
    if (error instanceof Error && /净化后为空/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update script' },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(['content']);
  if (!auth.ok) return auth.response;

  try {
    const deletedScripts = await deleteScriptsByIds([params.id]);
    await Promise.all(deletedScripts.map((script) => appendAuditLog({
      actor: auth.user,
      action: 'script.delete',
      targetType: 'script',
      targetId: script.id,
      summary: `删除脚本：${script.title}`
    })));

    return NextResponse.json({ deleted: deletedScripts.map((script) => ({ id: script.id, title: script.title })) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete script';
    const status = /不能删除|required|not found/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
