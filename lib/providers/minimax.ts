import path from 'path';
import { readFile, writeFile } from 'fs/promises';
import { EnvHttpProxyAgent, fetch as undiciFetch } from 'undici';
import { ensureDirectory } from '@/lib/storage';
import { publicPathFromRelative, resolveAppPath } from '@/lib/runtime/paths';
import type { VoiceSettings } from '@/lib/types';

const MINIMAX_BASE_URL = process.env.MINIMAX_API_HOST || process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com';
const MINIMAX_TEXT_BASE_URL = process.env.MINIMAX_TEXT_BASE_URL || process.env.MINIMAX_API_HOST || process.env.MINIMAX_BASE_URL || 'https://api.minimax.io';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINI_MAX_PROXY_AGENT = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.ALL_PROXY
  ? new EnvHttpProxyAgent()
  : undefined;
const MINIMAX_REQUEST_TIMEOUT_MS = 45000;
const MINIMAX_DOWNLOAD_TIMEOUT_MS = 45000;

interface MiniMaxImageOptions {
  prompt: string;
  outputRelativePath: string;
  model?: string;
  width?: number;
  height?: number;
}

interface MiniMaxSpeechOptions {
  text: string;
  outputRelativePath: string;
  model?: string;
  voiceId?: string;
  format?: 'mp3' | 'wav' | 'flac' | 'pcm';
}

interface MiniMaxVoiceCloneOptions {
  profileId: string;
  sampleAbsolutePath: string;
  fileName: string;
  settings: VoiceSettings;
}

interface MiniMaxConfiguredSpeechOptions {
  text: string;
  outputRelativePath: string;
  voiceId: string;
  settings: VoiceSettings;
  format?: 'mp3' | 'wav' | 'flac' | 'pcm';
}

interface MiniMaxTextOptions {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

function getMiniMaxConfig(settings?: VoiceSettings) {
  return {
    apiKey: settings?.minimaxApiKey || MINIMAX_API_KEY,
    baseUrl: settings?.minimaxBaseUrl || MINIMAX_BASE_URL,
    ttsModel: settings?.minimaxTtsModel || process.env.MINIMAX_TTS_MODEL || 'speech-2.8-hd',
    cloneModel: settings?.minimaxCloneModel || settings?.minimaxTtsModel || process.env.MINIMAX_VOICE_CLONE_MODEL || process.env.MINIMAX_TTS_MODEL || 'speech-2.8-hd',
    languageBoost: settings?.minimaxLanguageBoost || 'Chinese',
    voicePrefix: settings?.minimaxVoicePrefix || 'VideoFactory'
  };
}

function getAuthHeaders(settings?: VoiceSettings) {
  const config = getMiniMaxConfig(settings);
  if (!config.apiKey) {
    throw new Error('MINIMAX_API_KEY is not configured');
  }

  return {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
    'MM-API-Source': 'Video-Factory'
  };
}

function getMultipartAuthHeaders(settings?: VoiceSettings) {
  const config = getMiniMaxConfig(settings);
  if (!config.apiKey) {
    throw new Error('MINIMAX_API_KEY is not configured');
  }

  return {
    Authorization: `Bearer ${config.apiKey}`,
    'MM-API-Source': 'Video-Factory'
  };
}

function getAbsolutePath(relativePath: string) {
  return resolveAppPath(relativePath);
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? `; cause: ${error.cause.message}` : '';
    return `${error.name}: ${error.message}${cause}`;
  }
  return String(error);
}

async function fetchWithMiniMaxDiagnostics(url: string, init: RequestInit, context: string, timeoutMs = MINIMAX_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(`Timed out after ${timeoutMs}ms`), timeoutMs);

  try {
    return await undiciFetch(url, {
      ...init,
      signal: controller.signal,
      dispatcher: MINI_MAX_PROXY_AGENT
    } as any);
  } catch (error) {
    throw new Error(`MiniMax network request failed during ${context}: ${describeError(error)}; url=${url}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function writeBinaryFile(relativePath: string, buffer: Buffer) {
  const absolutePath = getAbsolutePath(relativePath);
  await ensureDirectory(path.dirname(absolutePath));
  await writeFile(absolutePath, buffer);
}

async function downloadToFile(url: string, outputRelativePath: string) {
  const response = await fetchWithMiniMaxDiagnostics(url, {}, 'downloading generated asset', MINIMAX_DOWNLOAD_TIMEOUT_MS);
  if (!response.ok) {
    const rawText = await response.text().catch(() => '');
    throw new Error(`Failed to download generated asset: ${response.status} ${rawText.slice(0, 500)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await writeBinaryFile(outputRelativePath, Buffer.from(arrayBuffer));
}

function extractImageUrl(payload: any): string | null {
  return payload?.data?.image_urls?.[0]
    || payload?.data?.images?.[0]?.url
    || payload?.data?.image_url
    || payload?.images?.[0]?.url
    || payload?.images?.[0]
    || payload?.output?.images?.[0]?.url
    || payload?.output?.images?.[0]
    || payload?.output?.[0]?.url
    || payload?.output?.[0]
    || payload?.url
    || null;
}

function extractAudioUrl(payload: any): string | null {
  return payload?.data?.audio_url
    || payload?.data?.url
    || payload?.audio_url
    || payload?.url
    || null;
}

function extractAudioHex(payload: any): string | null {
  return payload?.data?.audio
    || payload?.audio
    || null;
}

function extractFileId(payload: any): string | null {
  return payload?.file?.file_id
    || payload?.file_id
    || payload?.data?.file_id
    || payload?.data?.file?.file_id
    || payload?.id
    || null;
}

function inferAspectRatio(width?: number, height?: number) {
  const w = width || 1080;
  const h = height || 1920;

  if (w === h) return '1:1';
  if (Math.abs(w / h - 9 / 16) < 0.02) return '9:16';
  if (Math.abs(w / h - 16 / 9) < 0.02) return '16:9';
  if (Math.abs(w / h - 4 / 3) < 0.02) return '4:3';
  if (Math.abs(w / h - 3 / 4) < 0.02) return '3:4';

  return w > h ? '16:9' : '9:16';
}

function ensureJsonPayload(rawText: string, endpoint: string) {
  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(`MiniMax response is not valid JSON at ${endpoint}: ${rawText.slice(0, 1000)}`);
  }
}

function ensureMiniMaxBaseResp(payload: any, endpoint: string) {
  const baseResp = payload?.base_resp;
  if (baseResp && baseResp.status_code !== 0) {
    throw new Error(`MiniMax request failed at ${endpoint}: ${baseResp.status_code} ${baseResp.status_msg || 'Unknown error'}`);
  }
}

export function isMiniMaxConfigured() {
  return Boolean(MINIMAX_API_KEY);
}

function extractTextResponse(payload: any): string | null {
  return payload?.choices?.[0]?.message?.content
    || payload?.choices?.[0]?.text
    || payload?.reply
    || payload?.data?.text
    || payload?.output_text
    || payload?.text
    || null;
}

export async function generateTextWithMiniMax(options: MiniMaxTextOptions) {
  if (!MINIMAX_API_KEY) return null;

  const endpoint = '/v1/text/chatcompletion_v2';
  const requestBody = {
    model: options.model || process.env.MINIMAX_TEXT_MODEL || 'MiniMax-M2.7',
    messages: [
      {
        role: 'system',
        content: options.systemPrompt
      },
      {
        role: 'user',
        content: options.userPrompt
      }
    ],
    temperature: options.temperature ?? 0.35,
    max_tokens: options.maxTokens || 4096
  };

  const response = await fetchWithMiniMaxDiagnostics(
    `${MINIMAX_TEXT_BASE_URL}${endpoint}`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(requestBody)
    },
    `text generation request at ${endpoint}`,
    Number(process.env.MINIMAX_TEXT_TIMEOUT_MS || 60000)
  );

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`MiniMax text generation failed at ${endpoint}: ${response.status} ${rawText}`);
  }

  const payload = ensureJsonPayload(rawText, endpoint);
  ensureMiniMaxBaseResp(payload, endpoint);

  const text = extractTextResponse(payload);
  if (!text) {
    throw new Error(`MiniMax text response did not contain content at ${endpoint}: ${rawText.slice(0, 1200)}`);
  }

  return {
    text,
    endpoint,
    model: requestBody.model
  };
}

export async function generateImageWithMiniMax(options: MiniMaxImageOptions) {
  if (!MINIMAX_API_KEY) return null;

  const endpoint = '/v1/image_generation';
  const requestBody = {
    model: options.model || process.env.MINIMAX_IMAGE_MODEL || 'image-01',
    prompt: options.prompt,
    aspect_ratio: inferAspectRatio(options.width, options.height),
    n: 1,
    response_format: 'url',
    prompt_optimizer: true
  };

  const response = await fetchWithMiniMaxDiagnostics(
    `${MINIMAX_BASE_URL}${endpoint}`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(requestBody)
    },
    `image generation request at ${endpoint}`
  );

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`MiniMax image generation failed at ${endpoint}: ${response.status} ${rawText}`);
  }

  const payload = ensureJsonPayload(rawText, endpoint);
  ensureMiniMaxBaseResp(payload, endpoint);

  const imageUrl = extractImageUrl(payload);
  if (!imageUrl) {
    throw new Error(`MiniMax image response did not contain image_urls at ${endpoint}: ${rawText.slice(0, 1200)}`);
  }

  await downloadToFile(imageUrl, options.outputRelativePath);
  return {
    relativePath: options.outputRelativePath,
    publicPath: publicPathFromRelative(options.outputRelativePath),
    source: 'url' as const,
    endpoint
  };
}

export async function synthesizeSpeechWithMiniMax(options: MiniMaxSpeechOptions) {
  if (!MINIMAX_API_KEY) return null;

  const endpoint = '/v1/t2a_v2';
  const response = await fetchWithMiniMaxDiagnostics(
    `${MINIMAX_BASE_URL}${endpoint}`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        model: options.model || process.env.MINIMAX_TTS_MODEL || 'speech-2.8-hd',
        text: options.text,
        stream: false,
        voice_setting: {
          voice_id: options.voiceId || process.env.MINIMAX_VOICE_ID || 'female-tianmei',
          speed: 1.0,
          pitch: 0,
          emotion: 'happy'
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: options.format || 'mp3'
        }
      })
    },
    `speech synthesis request at ${endpoint}`
  );

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`MiniMax speech synthesis failed at ${endpoint}: ${response.status} ${rawText}`);
  }

  const payload = ensureJsonPayload(rawText, endpoint);
  ensureMiniMaxBaseResp(payload, endpoint);

  const audioUrl = extractAudioUrl(payload);
  if (audioUrl) {
    await downloadToFile(audioUrl, options.outputRelativePath);
    return {
      relativePath: options.outputRelativePath,
      publicPath: publicPathFromRelative(options.outputRelativePath),
      source: 'url' as const,
      endpoint
    };
  }

  const audioHex = extractAudioHex(payload);
  if (!audioHex) {
    throw new Error(`MiniMax speech response did not contain audio payload at ${endpoint}: ${rawText.slice(0, 1200)}`);
  }

  await writeBinaryFile(options.outputRelativePath, Buffer.from(audioHex, 'hex'));
  return {
    relativePath: options.outputRelativePath,
    publicPath: publicPathFromRelative(options.outputRelativePath),
    source: 'hex' as const,
    endpoint
  };
}

export async function cloneVoiceWithMiniMax(options: MiniMaxVoiceCloneOptions) {
  const config = getMiniMaxConfig(options.settings);
  const uploadEndpoint = '/v1/files/upload';
  const cloneEndpoint = '/v1/voice_clone';
  const sample = await readFile(options.sampleAbsolutePath);
  const form = new FormData();
  form.append('purpose', 'voice_clone');
  form.append('file', new Blob([sample]), options.fileName || 'voice-sample.wav');

  const uploadResponse = await fetchWithMiniMaxDiagnostics(
    `${config.baseUrl}${uploadEndpoint}`,
    {
      method: 'POST',
      headers: getMultipartAuthHeaders(options.settings),
      body: form
    },
    `voice sample upload at ${uploadEndpoint}`,
    120000
  );

  const uploadRawText = await uploadResponse.text();
  if (!uploadResponse.ok) {
    throw new Error(`MiniMax voice sample upload failed at ${uploadEndpoint}: ${uploadResponse.status} ${uploadRawText}`);
  }

  const uploadPayload = ensureJsonPayload(uploadRawText, uploadEndpoint);
  ensureMiniMaxBaseResp(uploadPayload, uploadEndpoint);
  const fileId = extractFileId(uploadPayload);
  if (!fileId) {
    throw new Error(`MiniMax file upload response did not include file_id: ${uploadRawText.slice(0, 1200)}`);
  }

  const safeSuffix = options.profileId.replace(/[^a-zA-Z0-9_-]/g, '').slice(-24);
  const voiceId = `${config.voicePrefix || 'VideoFactory'}_${safeSuffix}`;
  const cloneResponse = await fetchWithMiniMaxDiagnostics(
    `${config.baseUrl}${cloneEndpoint}`,
    {
      method: 'POST',
      headers: getAuthHeaders(options.settings),
      body: JSON.stringify({
        file_id: Number.isNaN(Number(fileId)) ? fileId : Number(fileId),
        voice_id: voiceId,
        model: config.cloneModel,
        need_noise_reduction: true
      })
    },
    `voice clone request at ${cloneEndpoint}`,
    120000
  );

  const cloneRawText = await cloneResponse.text();
  if (!cloneResponse.ok) {
    throw new Error(`MiniMax voice clone failed at ${cloneEndpoint}: ${cloneResponse.status} ${cloneRawText}`);
  }

  const clonePayload = ensureJsonPayload(cloneRawText, cloneEndpoint);
  ensureMiniMaxBaseResp(clonePayload, cloneEndpoint);

  return {
    providerVoiceId: clonePayload?.voice_id || clonePayload?.data?.voice_id || voiceId,
    fileId,
    endpoint: cloneEndpoint
  };
}

export async function synthesizeConfiguredSpeechWithMiniMax(options: MiniMaxConfiguredSpeechOptions) {
  const config = getMiniMaxConfig(options.settings);
  const endpoint = '/v1/t2a_v2';
  const response = await fetchWithMiniMaxDiagnostics(
    `${config.baseUrl}${endpoint}`,
    {
      method: 'POST',
      headers: getAuthHeaders(options.settings),
      body: JSON.stringify({
        model: config.ttsModel,
        text: options.text,
        stream: false,
        voice_setting: {
          voice_id: options.voiceId,
          speed: 1.0,
          pitch: 0,
          vol: 1.0
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: options.format || 'mp3',
          channel: 1
        },
        language_boost: config.languageBoost,
        output_format: 'hex'
      })
    },
    `configured speech synthesis request at ${endpoint}`,
    120000
  );

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`MiniMax configured speech synthesis failed at ${endpoint}: ${response.status} ${rawText}`);
  }

  const payload = ensureJsonPayload(rawText, endpoint);
  ensureMiniMaxBaseResp(payload, endpoint);

  const audioUrl = extractAudioUrl(payload);
  if (audioUrl) {
    await downloadToFile(audioUrl, options.outputRelativePath);
    return {
      relativePath: options.outputRelativePath,
      publicPath: publicPathFromRelative(options.outputRelativePath),
      source: 'url' as const,
      endpoint
    };
  }

  const audioHex = extractAudioHex(payload);
  if (!audioHex) {
    throw new Error(`MiniMax configured speech response did not contain audio payload at ${endpoint}: ${rawText.slice(0, 1200)}`);
  }

  await writeBinaryFile(options.outputRelativePath, Buffer.from(audioHex, 'hex'));
  return {
    relativePath: options.outputRelativePath,
    publicPath: publicPathFromRelative(options.outputRelativePath),
    source: 'hex' as const,
    endpoint
  };
}
