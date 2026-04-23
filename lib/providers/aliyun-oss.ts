import path from 'path';
import type { VoiceSettings } from '@/lib/types';

type OssClient = {
  put: (name: string, file: string | Buffer, options?: Record<string, unknown>) => Promise<{ name: string; url?: string }>;
  signatureUrl: (name: string, options?: Record<string, unknown>) => string;
};

function getOssConfig(settings: VoiceSettings) {
  return {
    region: settings.aliyunOssRegion || process.env.ALIYUN_OSS_REGION,
    endpoint: settings.aliyunOssEndpoint || process.env.ALIYUN_OSS_ENDPOINT,
    bucket: settings.aliyunOssBucket || process.env.ALIYUN_OSS_BUCKET,
    accessKeyId: settings.aliyunOssAccessKeyId || process.env.ALIYUN_OSS_ACCESS_KEY_ID,
    accessKeySecret: settings.aliyunOssAccessKeySecret || process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
    prefix: settings.aliyunOssPrefix || process.env.ALIYUN_OSS_PREFIX || 'video-factory/voice-samples',
    signedUrlExpiresSec: settings.aliyunOssSignedUrlExpiresSec || Number(process.env.ALIYUN_OSS_SIGNED_URL_EXPIRES_SEC) || 3600
  };
}

function requireOssConfig(settings: VoiceSettings) {
  const config = getOssConfig(settings);
  const missing = Object.entries({
    ALIYUN_OSS_REGION: config.region,
    ALIYUN_OSS_BUCKET: config.bucket,
    ALIYUN_OSS_ACCESS_KEY_ID: config.accessKeyId,
    ALIYUN_OSS_ACCESS_KEY_SECRET: config.accessKeySecret
  })
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(`Aliyun OSS is required for production CosyVoice clone. Missing: ${missing.join(', ')}`);
  }

  return config as Required<Pick<typeof config, 'region' | 'bucket' | 'accessKeyId' | 'accessKeySecret'>> & typeof config;
}

function createClient(settings: VoiceSettings): OssClient {
  const config = requireOssConfig(settings);
  // ali-oss does not ship a top-level TypeScript declaration in this version.
  // Keep the SDK behind this small adapter so the rest of the app stays typed.
  const OSS = require('ali-oss');
  return new OSS({
    region: config.region,
    endpoint: config.endpoint,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    secure: true,
    timeout: '120s'
  });
}

function normalizePrefix(prefix: string) {
  return prefix.replace(/^\/+|\/+$/g, '');
}

function safeObjectPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._/-]/g, '_').replace(/\/+/g, '/');
}

export function isAliyunOssConfigured(settings: VoiceSettings) {
  const config = getOssConfig(settings);
  return Boolean(config.region && config.bucket && config.accessKeyId && config.accessKeySecret);
}

export function getSignedVoiceSampleUrl(params: {
  objectKey: string;
  settings: VoiceSettings;
  expiresSec?: number;
}) {
  const config = getOssConfig(params.settings);
  const client = createClient(params.settings);
  return client.signatureUrl(params.objectKey, {
    method: 'GET',
    expires: params.expiresSec || config.signedUrlExpiresSec
  });
}

export async function uploadVoiceSampleToOss(params: {
  localAbsolutePath: string;
  userId: string;
  profileId: string;
  settings: VoiceSettings;
}) {
  const config = getOssConfig(params.settings);
  const client = createClient(params.settings);
  const prefix = normalizePrefix(config.prefix);
  const objectKey = safeObjectPart(path.posix.join(
    prefix,
    params.userId,
    params.profileId,
    'sample-cosyvoice.wav'
  ));

  await client.put(objectKey, params.localAbsolutePath, {
    mime: 'audio/wav',
    headers: {
      'Content-Type': 'audio/wav'
    }
  });

  return {
    objectKey,
    signedUrl: getSignedVoiceSampleUrl({
      objectKey,
      settings: params.settings
    })
  };
}

export async function testAliyunOssStorage(settings: VoiceSettings) {
  const config = getOssConfig(settings);
  const client = createClient(settings);
  const prefix = normalizePrefix(config.prefix);
  const objectKey = safeObjectPart(path.posix.join(
    prefix,
    '_health',
    `oss-test-${Date.now()}.txt`
  ));
  const content = `video-factory oss test ${new Date().toISOString()}\n`;

  await client.put(objectKey, Buffer.from(content), {
    mime: 'text/plain',
    headers: {
      'Content-Type': 'text/plain'
    }
  });

  const signedUrl = getSignedVoiceSampleUrl({
    objectKey,
    settings,
    expiresSec: Math.min(config.signedUrlExpiresSec, 300)
  });
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Aliyun OSS signed URL fetch failed: ${response.status}`);
  }
  const downloaded = await response.text();
  if (downloaded !== content) {
    throw new Error('Aliyun OSS signed URL content check failed');
  }

  return {
    objectKey,
    signedUrlExpiresSec: Math.min(config.signedUrlExpiresSec, 300)
  };
}
