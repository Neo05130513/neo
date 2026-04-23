import { nowIso, readJsonFile, writeJsonFile } from './storage';
import type { VoiceSettings } from './types';

const settingsPath = 'data/voice-settings.json';

const defaultSettings: VoiceSettings = {
  provider: 'aliyun-cosyvoice',
  dashscopeBaseUrl: 'https://dashscope.aliyuncs.com',
  cosyvoiceModel: 'cosyvoice-v2',
  cosyvoiceCloneModel: 'voice-enrollment',
  cosyvoiceTestVoiceId: 'longxiaochun_v2',
  cosyvoiceVoicePrefix: 'videofactory',
  cosyvoiceChunkCharLimit: 1800,
  aliyunOssPrefix: 'video-factory/voice-samples',
  aliyunOssSignedUrlExpiresSec: 3600,
  minimaxBaseUrl: 'https://api.minimaxi.com',
  minimaxTtsModel: 'speech-2.8-hd',
  minimaxCloneModel: 'speech-2.8-hd',
  minimaxLanguageBoost: 'Chinese',
  minimaxVoicePrefix: 'VideoFactory',
  updatedAt: nowIso()
};

export async function getVoiceSettings(): Promise<VoiceSettings> {
  try {
    const stored = await readJsonFile<Partial<VoiceSettings>>(settingsPath);
    return {
      ...defaultSettings,
      ...stored,
      dashscopeApiKey: stored.dashscopeApiKey || process.env.DASHSCOPE_API_KEY,
      dashscopeBaseUrl: stored.dashscopeBaseUrl || process.env.DASHSCOPE_BASE_URL || defaultSettings.dashscopeBaseUrl,
      cosyvoiceModel: stored.cosyvoiceModel || process.env.COSYVOICE_MODEL || defaultSettings.cosyvoiceModel,
      cosyvoiceCloneModel: stored.cosyvoiceCloneModel || process.env.COSYVOICE_CLONE_MODEL || stored.cosyvoiceModel || process.env.COSYVOICE_MODEL || defaultSettings.cosyvoiceCloneModel,
      cosyvoiceTestVoiceId: stored.cosyvoiceTestVoiceId || process.env.COSYVOICE_TEST_VOICE_ID || defaultSettings.cosyvoiceTestVoiceId,
      cosyvoiceVoicePrefix: stored.cosyvoiceVoicePrefix || process.env.COSYVOICE_VOICE_PREFIX || defaultSettings.cosyvoiceVoicePrefix,
      cosyvoicePublicBaseUrl: stored.cosyvoicePublicBaseUrl || process.env.PUBLIC_BASE_URL || process.env.COSYVOICE_PUBLIC_BASE_URL,
      cosyvoiceChunkCharLimit: stored.cosyvoiceChunkCharLimit || Number(process.env.COSYVOICE_CHUNK_CHAR_LIMIT) || defaultSettings.cosyvoiceChunkCharLimit,
      aliyunOssRegion: stored.aliyunOssRegion || process.env.ALIYUN_OSS_REGION,
      aliyunOssEndpoint: stored.aliyunOssEndpoint || process.env.ALIYUN_OSS_ENDPOINT,
      aliyunOssBucket: stored.aliyunOssBucket || process.env.ALIYUN_OSS_BUCKET,
      aliyunOssAccessKeyId: stored.aliyunOssAccessKeyId || process.env.ALIYUN_OSS_ACCESS_KEY_ID,
      aliyunOssAccessKeySecret: stored.aliyunOssAccessKeySecret || process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
      aliyunOssPrefix: stored.aliyunOssPrefix || process.env.ALIYUN_OSS_PREFIX || defaultSettings.aliyunOssPrefix,
      aliyunOssSignedUrlExpiresSec: stored.aliyunOssSignedUrlExpiresSec || Number(process.env.ALIYUN_OSS_SIGNED_URL_EXPIRES_SEC) || defaultSettings.aliyunOssSignedUrlExpiresSec,
      minimaxApiKey: stored.minimaxApiKey || process.env.MINIMAX_API_KEY,
      minimaxBaseUrl: stored.minimaxBaseUrl || process.env.MINIMAX_API_HOST || process.env.MINIMAX_BASE_URL || defaultSettings.minimaxBaseUrl,
      minimaxTtsModel: stored.minimaxTtsModel || process.env.MINIMAX_TTS_MODEL || defaultSettings.minimaxTtsModel,
      minimaxCloneModel: stored.minimaxCloneModel || process.env.MINIMAX_VOICE_CLONE_MODEL || stored.minimaxTtsModel || process.env.MINIMAX_TTS_MODEL || defaultSettings.minimaxCloneModel,
      voiceProviderApiKey: stored.voiceProviderApiKey || process.env.VOICE_PROVIDER_API_KEY,
      voiceCloneEndpoint: stored.voiceCloneEndpoint || process.env.VOICE_CLONE_ENDPOINT,
      voiceTtsEndpoint: stored.voiceTtsEndpoint || process.env.VOICE_TTS_ENDPOINT
    };
  } catch {
    return {
      ...defaultSettings,
      dashscopeApiKey: process.env.DASHSCOPE_API_KEY,
      dashscopeBaseUrl: process.env.DASHSCOPE_BASE_URL || defaultSettings.dashscopeBaseUrl,
      cosyvoiceModel: process.env.COSYVOICE_MODEL || defaultSettings.cosyvoiceModel,
      cosyvoiceCloneModel: process.env.COSYVOICE_CLONE_MODEL || process.env.COSYVOICE_MODEL || defaultSettings.cosyvoiceCloneModel,
      cosyvoiceTestVoiceId: process.env.COSYVOICE_TEST_VOICE_ID || defaultSettings.cosyvoiceTestVoiceId,
      cosyvoiceVoicePrefix: process.env.COSYVOICE_VOICE_PREFIX || defaultSettings.cosyvoiceVoicePrefix,
      cosyvoicePublicBaseUrl: process.env.PUBLIC_BASE_URL || process.env.COSYVOICE_PUBLIC_BASE_URL,
      cosyvoiceChunkCharLimit: Number(process.env.COSYVOICE_CHUNK_CHAR_LIMIT) || defaultSettings.cosyvoiceChunkCharLimit,
      aliyunOssRegion: process.env.ALIYUN_OSS_REGION,
      aliyunOssEndpoint: process.env.ALIYUN_OSS_ENDPOINT,
      aliyunOssBucket: process.env.ALIYUN_OSS_BUCKET,
      aliyunOssAccessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
      aliyunOssAccessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
      aliyunOssPrefix: process.env.ALIYUN_OSS_PREFIX || defaultSettings.aliyunOssPrefix,
      aliyunOssSignedUrlExpiresSec: Number(process.env.ALIYUN_OSS_SIGNED_URL_EXPIRES_SEC) || defaultSettings.aliyunOssSignedUrlExpiresSec,
      minimaxApiKey: process.env.MINIMAX_API_KEY,
      minimaxBaseUrl: process.env.MINIMAX_API_HOST || process.env.MINIMAX_BASE_URL || defaultSettings.minimaxBaseUrl,
      minimaxTtsModel: process.env.MINIMAX_TTS_MODEL || defaultSettings.minimaxTtsModel,
      minimaxCloneModel: process.env.MINIMAX_VOICE_CLONE_MODEL || process.env.MINIMAX_TTS_MODEL || defaultSettings.minimaxCloneModel,
      voiceProviderApiKey: process.env.VOICE_PROVIDER_API_KEY,
      voiceCloneEndpoint: process.env.VOICE_CLONE_ENDPOINT,
      voiceTtsEndpoint: process.env.VOICE_TTS_ENDPOINT
    };
  }
}

export async function getSafeVoiceSettings() {
  const settings = await getVoiceSettings();
  return {
    ...settings,
    dashscopeApiKey: settings.dashscopeApiKey ? 'configured' : '',
    aliyunOssAccessKeySecret: settings.aliyunOssAccessKeySecret ? 'configured' : '',
    minimaxApiKey: settings.minimaxApiKey ? 'configured' : '',
    voiceProviderApiKey: settings.voiceProviderApiKey ? 'configured' : ''
  };
}

export async function updateVoiceSettings(input: Partial<VoiceSettings> & { clearDashScopeApiKey?: boolean; clearAliyunOssAccessKeySecret?: boolean; clearMiniMaxApiKey?: boolean; clearVoiceProviderApiKey?: boolean }) {
  const current = await getVoiceSettings();
  const next: VoiceSettings = {
    ...current,
    provider: input.provider || current.provider,
    dashscopeBaseUrl: input.dashscopeBaseUrl?.trim() || current.dashscopeBaseUrl,
    cosyvoiceModel: input.cosyvoiceModel?.trim() || current.cosyvoiceModel,
    cosyvoiceCloneModel: input.cosyvoiceCloneModel?.trim() || current.cosyvoiceCloneModel,
    cosyvoiceTestVoiceId: input.cosyvoiceTestVoiceId?.trim() || current.cosyvoiceTestVoiceId,
    cosyvoiceVoicePrefix: input.cosyvoiceVoicePrefix?.trim() || current.cosyvoiceVoicePrefix,
    cosyvoicePublicBaseUrl: input.cosyvoicePublicBaseUrl?.trim() || current.cosyvoicePublicBaseUrl,
    cosyvoiceChunkCharLimit: typeof input.cosyvoiceChunkCharLimit === 'number' && input.cosyvoiceChunkCharLimit > 0
      ? input.cosyvoiceChunkCharLimit
      : current.cosyvoiceChunkCharLimit,
    aliyunOssRegion: input.aliyunOssRegion?.trim() || current.aliyunOssRegion,
    aliyunOssEndpoint: input.aliyunOssEndpoint?.trim() || current.aliyunOssEndpoint,
    aliyunOssBucket: input.aliyunOssBucket?.trim() || current.aliyunOssBucket,
    aliyunOssAccessKeyId: input.aliyunOssAccessKeyId?.trim() || current.aliyunOssAccessKeyId,
    aliyunOssPrefix: input.aliyunOssPrefix?.trim() || current.aliyunOssPrefix,
    aliyunOssSignedUrlExpiresSec: typeof input.aliyunOssSignedUrlExpiresSec === 'number' && input.aliyunOssSignedUrlExpiresSec > 0
      ? input.aliyunOssSignedUrlExpiresSec
      : current.aliyunOssSignedUrlExpiresSec,
    minimaxBaseUrl: input.minimaxBaseUrl?.trim() || current.minimaxBaseUrl,
    minimaxTtsModel: input.minimaxTtsModel?.trim() || current.minimaxTtsModel,
    minimaxCloneModel: input.minimaxCloneModel?.trim() || current.minimaxCloneModel,
    minimaxLanguageBoost: input.minimaxLanguageBoost?.trim() || current.minimaxLanguageBoost,
    minimaxVoicePrefix: input.minimaxVoicePrefix?.trim() || current.minimaxVoicePrefix,
    voiceCloneEndpoint: input.voiceCloneEndpoint?.trim() || current.voiceCloneEndpoint,
    voiceTtsEndpoint: input.voiceTtsEndpoint?.trim() || current.voiceTtsEndpoint,
    updatedAt: nowIso()
  };

  if (input.clearDashScopeApiKey) {
    next.dashscopeApiKey = undefined;
  } else if (input.dashscopeApiKey && input.dashscopeApiKey !== 'configured') {
    next.dashscopeApiKey = input.dashscopeApiKey.trim();
  }

  if (input.clearAliyunOssAccessKeySecret) {
    next.aliyunOssAccessKeySecret = undefined;
  } else if (input.aliyunOssAccessKeySecret && input.aliyunOssAccessKeySecret !== 'configured') {
    next.aliyunOssAccessKeySecret = input.aliyunOssAccessKeySecret.trim();
  }

  if (input.clearMiniMaxApiKey) {
    next.minimaxApiKey = undefined;
  } else if (input.minimaxApiKey && input.minimaxApiKey !== 'configured') {
    next.minimaxApiKey = input.minimaxApiKey.trim();
  }

  if (input.clearVoiceProviderApiKey) {
    next.voiceProviderApiKey = undefined;
  } else if (input.voiceProviderApiKey && input.voiceProviderApiKey !== 'configured') {
    next.voiceProviderApiKey = input.voiceProviderApiKey.trim();
  }

  await writeJsonFile(settingsPath, next);
  return next;
}
