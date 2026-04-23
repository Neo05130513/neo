import { NextResponse } from 'next/server';
import { getCurrentUser, logoutCurrentUser } from '@/lib/auth';
import { appendAuditLog } from '@/lib/audit';
import { changeOwnPassword } from '@/lib/users';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const password = String(body.password || '').trim();

    if (!password) {
      return NextResponse.json({ error: 'password is required' }, { status: 400 });
    }

    const updatedUser = await changeOwnPassword(user.id, password);
    await logoutCurrentUser();
    await appendAuditLog({
      actor: updatedUser,
      action: 'user.password.changed',
      targetType: 'system',
      targetId: updatedUser.id,
      summary: `用户完成密码更新：${updatedUser.name}`
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to change password' }, { status: 500 });
  }
}
