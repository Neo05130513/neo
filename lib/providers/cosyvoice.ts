import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import path from 'path';
import { ensureDirectory, writeTextFile } from '@/lib/storage';
import { generatedRelativePath, publicPathFromRelative, resolveAppPath } from '@/lib/runtime/paths';
import type { VoiceSettings } from '@/lib/types';

const execFileAsync = promisify(execFile);

function getConfig(settings: VoiceSettings) {
  return {
    apiKey: settings.dashscopeApiKey || process.env.DASHSCOPE_API_KEY,
    baseUrl: settings.dashscopeBaseUrl || process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com',
    model: settings.cosyvoiceModel || process.env.COSYVOICE_MODEL || 'cosyvoice-v2',
    cloneModel: settings.cosyvoiceCloneModel || settings.cosyvoiceModel || process.env.COSYVOICE_CLONE_MODEL || process.env.COSYVOICE_MODEL || 'cosyvoice-v2',
    testVoiceId: settings.cosyvoiceTestVoiceId || process.env.COSYVOICE_TEST_VOICE_ID || 'longxiaochun_v2',
    voicePrefix: settings.cosyvoiceVoicePrefix || process.env.COSYVOICE_VOICE_PREFIX || 'videofactory',
    publicBaseUrl: settings.cosyvoicePublicBaseUrl || process.env.PUBLIC_BASE_URL || process.env.COSYVOICE_PUBLIC_BASE_URL,
    chunkCharLimit: settings.cosyvoiceChunkCharLimit || Number(process.env.COSYVOICE_CHUNK_CHAR_LIMIT) || 1800
  };
}

function authHeaders(settings: VoiceSettings) {
  const config = getConfig(settings);
  if (!config.apiKey) throw new Error('DASHSCOPE_API_KEY is required for CosyVoice');
  return {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json'
  };
}

function weightedLength(text: string) {
  return Array.from(text).reduce((total, char) => total + (/[\u4e00-\u9fff]/.test(char) ? 2 : 1), 0);
}

export function splitLongTextForTts(text: string, maxWeightedChars = 1800) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [''];

  const sentences = normalized
    .replace(/([。！？；!?;])/g, '$1\n')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences.length ? sentences : [normalized]) {
    if (weightedLength(sentence) > maxWeightedChars) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      let segment = '';
      for (const char of Array.from(sentence)) {
        if (weightedLength(segment + char) > maxWeightedChars) {
          chunks.push(segment);
          segment = char;
        } else {
          segment += char;
        }
      }
      if (segment) chunks.push(segment);
      continue;
    }

    const next = current ? `${current}${sentence}` : sentence;
    if (weightedLength(next) > maxWeightedChars && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function extractAudioUrl(payload: any) {
  return payload?.output?.audio?.url
    || payload?.output?.url
    || payload?.output?.audio_url
    || payload?.audio_url
    || payload?.url
    || payload?.data?.url
    || null;
}

function extractVoiceId(payload: any) {
  return payload?.output?.voice_id
    || payload?.output?.voiceId
    || payload?.voice_id
    || payload?.voiceId
    || payload?.data?.voice_id
    || null;
}

async function downloadToFile(url: string, outputRelativePath: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download CosyVoice audio: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const absolutePath = resolveAppPath(outputRelativePath);
  await ensureDirectory(path.dirname(absolutePath));
  await writeFile(absolutePath, buffer);
}

export async function cloneVoiceWithCosyVoice(params: {
  profileId: string;
  sampleUrl?: string;
  samplePublicPath?: string;
  settings: VoiceSettings;
}) {
  const config = getConfig(params.settings);
  if (!params.sampleUrl && !config.publicBaseUrl) {
    throw new Error('CosyVoice voice clone requires PUBLIC_BASE_URL or cosyvoicePublicBaseUrl so Aliyun can fetch the sample audio');
  }

  const sampleUrl = params.sampleUrl || new URL(params.samplePublicPath || '', config.publicBaseUrl!.endsWith('/') ? config.publicBaseUrl! : `${config.publicBaseUrl}/`).toString();
  const endpoint = `${config.baseUrl}/api/v1/services/audio/tts/customization`;
  const safeSuffix = params.profileId.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toLowerCase();
  const safePrefix = (config.voicePrefix || 'vf').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 6) || 'vf';
  const prefix = `${safePrefix}${safeSuffix}`.slice(0, 10);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: authHeaders(params.settings),
    body: JSON.stringify({
      model: config.cloneModel,
      input: {
        action: 'create_voice',
        target_model: config.model,
        prefix,
        url: sampleUrl,
        language_hints: ['zh']
      }
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `CosyVoice clone failed: ${response.status}`);
  }
  const voiceId = extractVoiceId(payload);
  if (!voiceId) throw new Error(`CosyVoice clone response did not include voice_id: ${JSON.stringify(payload).slice(0, 1200)}`);
  return { providerVoiceId: voiceId, endpoint };
}

async function synthesizeCosyVoiceChunk(params: {
  text: string;
  voiceId: string;
  settings: VoiceSettings;
  outputRelativePath: string;
}) {
  const config = getConfig(params.settings);
  const endpoint = `${config.baseUrl}/api/v1/services/audio/tts/SpeechSynthesizer`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: authHeaders(params.settings),
    body: JSON.stringify({
      model: config.model,
      input: {
        text: params.text,
        voice: params.voiceId
      },
      parameters: {
        format: 'wav',
        sample_rate: 24000
      }
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `CosyVoice TTS failed: ${response.status}`);
  }
  const audioUrl = extractAudioUrl(payload);
  if (!audioUrl) throw new Error(`CosyVoice TTS response did not include audio URL: ${JSON.stringify(payload).slice(0, 1200)}`);
  await downloadToFile(audioUrl, params.outputRelativePath);
  return {
    relativePath: params.outputRelativePath,
    publicPath: publicPathFromRelative(params.outputRelativePath),
    endpoint
  };
}

async function concatAudioFiles(inputRelativePaths: string[], outputRelativePath: string) {
  const outputAbsolutePath = resolveAppPath(outputRelativePath);
  await ensureDirectory(path.dirname(outputAbsolutePath));

  const listRelativePath = generatedRelativePath('voice-temp', `concat-${Date.now()}.txt`);
  const listContent = inputRelativePaths
    .map((relativePath) => `file '${resolveAppPath(relativePath).replace(/'/g, `'\\''`)}'`)
    .join('\n') + '\n';
  await writeTextFile(listRelativePath, listContent);

  await execFileAsync('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', resolveAppPath(listRelativePath),
    '-c', 'copy',
    outputAbsolutePath
  ]);
}

export async function synthesizeLongSpeechWithCosyVoice(params: {
  text: string;
  voiceId: string;
  settings: VoiceSettings;
  outputRelativePath: string;
}) {
  const config = getConfig(params.settings);
  const chunks = splitLongTextForTts(params.text, config.chunkCharLimit);
  if (chunks.length === 1) {
    return synthesizeCosyVoiceChunk({
      text: chunks[0],
      voiceId: params.voiceId,
      settings: params.settings,
      outputRelativePath: params.outputRelativePath.replace(/\.mp3$/i, '.wav')
    });
  }

  const chunkRelativePaths: string[] = [];
  const finalOutputRelativePath = params.outputRelativePath.replace(/\.mp3$/i, '.wav');
  for (let index = 0; index < chunks.length; index += 1) {
    const chunkRelativePath = finalOutputRelativePath.replace(/\.wav$/i, `.part-${String(index + 1).padStart(3, '0')}.wav`);
    await synthesizeCosyVoiceChunk({
      text: chunks[index],
      voiceId: params.voiceId,
      settings: params.settings,
      outputRelativePath: chunkRelativePath
    });
    chunkRelativePaths.push(chunkRelativePath);
  }

  await concatAudioFiles(chunkRelativePaths, finalOutputRelativePath);
  return {
    relativePath: finalOutputRelativePath,
    publicPath: publicPathFromRelative(finalOutputRelativePath),
    endpoint: 'cosyvoice-long-text-chunked',
    chunks: chunks.length
  };
}
