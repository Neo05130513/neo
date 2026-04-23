import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { listVoiceProfiles } from '@/lib/voice-profiles';

export async function GET() {
  const auth = await requireApiRole(['video', 'content']);
  if (!auth.ok) return auth.response;

  const profiles = await listVoiceProfiles();
  return NextResponse.json({
    ok: true,
    profiles: profiles.filter((profile) => profile.userId === auth.user.id)
  });
}
