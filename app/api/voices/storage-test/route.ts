import { NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/audit';
import { requireApiRole } from '@/lib/api-auth';
import { testAliyunOssStorage } from '@/lib/providers/aliyun-oss';
import { getVoiceSettings } from '@/lib/voice-settings';

export async function POST() {
  const auth = await requireApiRole(['video']);
  if (!auth.ok) return auth.response;

  try {
    const settings = await getVoiceSettings();
    const result = await testAliyunOssStorage(settings);
    await appendAuditLog({
      actor: auth.user,
      action: 'voice.storage.test',
      targetType: 'system',
      targetId: 'aliyun-oss',
      summary: `测试 OSS 样音存储：${result.objectKey}`
    });
    return NextResponse.json({ ok: true, storage: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Aliyun OSS storage test failed' },
      { status: 500 }
    );
  }
}
