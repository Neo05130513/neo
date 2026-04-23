import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { disableUserAccount } from '@/lib/users';

export async function POST(request: Request) {
  const auth = await requireApiRole(['admin']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const userId = String(body.userId || '').trim();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const user = await disableUserAccount(userId);
    await appendAuditLog({
      actor: auth.user,
      action: 'user.disable',
      targetType: 'system',
      targetId: user.id,
      summary: `停用账号：${user.name}`
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to disable user' }, { status: 500 });
  }
}
