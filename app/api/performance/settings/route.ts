import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { getPerformanceSettings, updatePerformanceSettings } from '@/lib/performance/settings';

export async function GET() {
  const auth = await requireApiRole(['admin', 'content', 'video']);
  if (!auth.ok) return auth.response;
  const payload = await getPerformanceSettings();
  return NextResponse.json(payload);
}

export async function PATCH(request: Request) {
  const auth = await requireApiRole(['admin', 'content', 'video']);
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const payload = await updatePerformanceSettings(body);
  return NextResponse.json(payload);
}
