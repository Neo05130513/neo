import { NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/audit';
import { requireApiRole } from '@/lib/api-auth';
import { ensureVoiceProfileReady } from '@/lib/voice-provider';
import { getVoiceProfileById } from '@/lib/voice-profiles';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(['video']);
  if (!auth.ok) return auth.response;

  try {
    const profile = await getVoiceProfileById(params.id);
    if (!profile || profile.userId !== auth.user.id) {
      return NextResponse.json({ error: 'Voice profile not found' }, { status: 404 });
    }

    const readyProfile = await ensureVoiceProfileReady(profile);
    await appendAuditLog({
      actor: auth.user,
      action: 'voice.clone.retry',
      targetType: 'system',
      targetId: readyProfile.id,
      summary: `重试声音复刻：${readyProfile.name}`
    });
    return NextResponse.json({ ok: true, profile: readyProfile });
  } catch (error) {
    const latestProfile = await getVoiceProfileById(params.id);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Voice clone retry failed',
        profile: latestProfile
      },
      { status: 502 }
    );
  }
}
