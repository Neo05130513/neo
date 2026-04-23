import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { resetUserPassword } from '@/lib/users';

export async function POST(request: Request) {
  const auth = await requireApiRole(['admin']);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const userId = String(body.userId || '').trim();
    const password = String(body.password || '').trim();

    if (!userId || !password) {
      return NextResponse.json({ error: 'userId and password are required' }, { status: 400 });
    }

    const user = await resetUserPassword(userId, password);
    await appendAuditLog({
      actor: auth.user,
      action: 'user.password.reset',
      targetType: 'system',
      targetId: user.id,
      summary: `重置账号密码：${user.name}`
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to reset password' }, { status: 500 });
  }
}
