import { NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/audit';
import { requireApiRole } from '@/lib/api-auth';
import { setDefaultVoiceProfile } from '@/lib/voice-profiles';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(['video']);
  if (!auth.ok) return auth.response;

  try {
    const profile = await setDefaultVoiceProfile({
      userId: auth.user.id,
      profileId: params.id
    });
    await appendAuditLog({
      actor: auth.user,
      action: 'voice.profile.default',
      targetType: 'system',
      targetId: profile.id,
      summary: `设置默认音色：${profile.name}`
    });
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set default voice profile' },
      { status: 500 }
    );
  }
}
