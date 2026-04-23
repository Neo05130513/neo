import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { revokeSessionById } from '@/lib/auth';

export async function POST(request: Request) {
  const auth = await requireApiRole(['admin']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const sessionId = String(body.sessionId || '').trim();
    const userId = String(body.userId || '').trim();

    if (!sessionId || !userId) {
      return NextResponse.json({ error: 'sessionId and userId are required' }, { status: 400 });
    }

    await revokeSessionById(sessionId);
    await appendAuditLog({
      actor: auth.user,
      action: 'session.revoke',
      targetType: 'system',
      targetId: userId,
      summary: `强制下线 session：${sessionId}`
    });

    return NextResponse.json({ ok: true, sessionId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to revoke session' }, { status: 500 });
  }
}
