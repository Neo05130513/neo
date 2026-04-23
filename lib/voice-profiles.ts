import { readFile, writeFile } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { ensureDirectory, nowIso, readJsonFile, simpleId, writeJsonFile } from './storage';
import type { UserAccount, VoiceProfile } from './types';
import { getVoiceSettings } from './voice-settings';
import { generatedRelativePath, publicPathFromRelative, resolveAppPath } from './runtime/paths';
import { uploadVoiceSampleToOss } from './providers/aliyun-oss';

const voiceProfilesPath = 'data/voice-profiles.json';
const execFileAsync = promisify(execFile);

async function readVoiceProfiles() {
  try {
    return await readJsonFile<VoiceProfile[]>(voiceProfilesPath);
  } catch {
    return [];
  }
}

async function writeVoiceProfiles(profiles: VoiceProfile[]) {
  await writeJsonFile(voiceProfilesPath, profiles);
}

function safeExtension(fileName: string, fallback = 'wav') {
  const ext = path.extname(fileName).replace(/^\./, '').toLowerCase();
  if (!ext) return fallback;
  if (!['wav', 'mp3', 'm4a', 'aac', 'ogg', 'webm'].includes(ext)) return fallback;
  return ext;
}

async function createCosyVoiceSample(inputAbsolutePath: string, outputAbsolutePath: string) {
  await ensureDirectory(path.dirname(outputAbsolutePath));
  await execFileAsync('ffmpeg', [
    '-y',
    '-i', inputAbsolutePath,
    '-ss', '0',
    '-t', '20',
    '-ac', '1',
    '-ar', '16000',
    '-sample_fmt', 's16',
    outputAbsolutePath
  ]);
}

export async function listVoiceProfiles() {
  return readVoiceProfiles();
}

export async function getDefaultVoiceProfile() {
  const profiles = await readVoiceProfiles();
  return profiles.find((profile) => profile.isDefault && profile.status !== 'failed')
    || profiles.find((profile) => profile.status === 'ready')
    || profiles.find((profile) => profile.status === 'sample_uploaded')
    || null;
}

export async function getVoiceProfileById(profileId: string) {
  const profiles = await readVoiceProfiles();
  return profiles.find((profile) => profile.id === profileId) || null;
}

export async function saveUploadedVoiceSample(params: {
  user: UserAccount;
  fileName: string;
  bytes: ArrayBuffer;
  displayName?: string;
}) {
  const profiles = await readVoiceProfiles();
  const profileId = simpleId('voice_profile');
  const ext = safeExtension(params.fileName);
  const relativePath = generatedRelativePath('voices', params.user.id, profileId, `sample.${ext}`);
  const absolutePath = resolveAppPath(relativePath);
  await ensureDirectory(path.dirname(absolutePath));
  await writeFile(absolutePath, Buffer.from(params.bytes));

  const timestamp = nowIso();
  const settings = await getVoiceSettings();
  let samplePath = publicPathFromRelative(relativePath);
  if (settings.provider === 'aliyun-cosyvoice') {
    const cosyRelativePath = generatedRelativePath('voices', params.user.id, profileId, 'sample-cosyvoice.wav');
    const cosyAbsolutePath = resolveAppPath(cosyRelativePath);
    await createCosyVoiceSample(absolutePath, cosyAbsolutePath);
    samplePath = publicPathFromRelative(cosyRelativePath);
  }

  const profile: VoiceProfile = {
    id: profileId,
    userId: params.user.id,
    name: params.displayName?.trim() || params.fileName.replace(/\.[^.]+$/, '') || '我的声音',
    provider: settings.provider,
    status: 'sample_uploaded',
    samplePath,
    isDefault: true,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const initialProfiles = [
    profile,
    ...profiles.map((item) => item.userId === params.user.id ? { ...item, isDefault: false } : item)
  ];
  await writeVoiceProfiles(initialProfiles);

  if (settings.provider === 'aliyun-cosyvoice' && samplePath.endsWith('sample-cosyvoice.wav')) {
    try {
      const upload = await uploadVoiceSampleToOss({
        localAbsolutePath: getVoiceSampleAbsolutePath(profile),
        userId: params.user.id,
        profileId,
        settings
      });
      const uploadedProfile: VoiceProfile = {
        ...profile,
        sampleObjectKey: upload.objectKey,
        sampleStorageProvider: 'aliyun-oss',
        lastError: undefined,
        updatedAt: nowIso()
      };
      await updateVoiceProfile(uploadedProfile);
      return uploadedProfile;
    } catch (error) {
      const failedProfile: VoiceProfile = {
        ...profile,
        status: 'failed',
        lastError: error instanceof Error ? error.message : 'Aliyun OSS voice sample upload failed',
        updatedAt: nowIso()
      };
      await updateVoiceProfile(failedProfile);
      return failedProfile;
    }
  }

  return profile;
}

export async function updateVoiceProfile(nextProfile: VoiceProfile) {
  const profiles = await readVoiceProfiles();
  await writeVoiceProfiles(profiles.map((profile) => profile.id === nextProfile.id ? nextProfile : profile));
  return nextProfile;
}

export async function setDefaultVoiceProfile(params: {
  userId: string;
  profileId: string;
}) {
  const profiles = await readVoiceProfiles();
  const target = profiles.find((profile) => profile.id === params.profileId && profile.userId === params.userId);
  if (!target) throw new Error('Voice profile not found');

  const timestamp = nowIso();
  const updatedProfiles = profiles.map((profile) => profile.userId === params.userId
    ? { ...profile, isDefault: profile.id === params.profileId, updatedAt: profile.id === params.profileId ? timestamp : profile.updatedAt }
    : profile);
  await writeVoiceProfiles(updatedProfiles);
  return updatedProfiles.find((profile) => profile.id === params.profileId)!;
}

export async function readVoiceSampleBuffer(profile: VoiceProfile) {
  const relative = profile.samplePath.replace(/^\//, 'public/');
  return readFile(resolveAppPath(relative));
}

export function getVoiceSampleAbsolutePath(profile: VoiceProfile) {
  const relative = profile.samplePath.replace(/^\//, 'public/');
  return resolveAppPath(relative);
}
