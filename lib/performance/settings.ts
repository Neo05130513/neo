import { readJsonFile, writeJsonFile } from '@/lib/storage';
import { getDeviceInfo, type DeviceInfo } from './device-info';

export type PerformanceMode = 'conservative' | 'balanced' | 'high';

export type PerformanceSettings = {
  mode: PerformanceMode;
  totalTaskConcurrency: number;
  renderConcurrency: number;
  ttsConcurrency: number;
  imageConcurrency: number;
  queueCapacity: number;
  autoPauseOnLowMemory: boolean;
  lowMemoryThresholdGb: number;
};

const settingsPath = 'data/performance-settings.json';

export function recommendPerformanceSettings(device: DeviceInfo): PerformanceSettings {
  if (device.deviceTier === 'workstation') {
    return {
      mode: 'high',
      totalTaskConcurrency: 4,
      renderConcurrency: 2,
      ttsConcurrency: 4,
      imageConcurrency: 3,
      queueCapacity: 30,
      autoPauseOnLowMemory: false,
      lowMemoryThresholdGb: 4
    };
  }

  if (device.deviceTier === 'pro') {
    return {
      mode: 'balanced',
      totalTaskConcurrency: 2,
      renderConcurrency: 1,
      ttsConcurrency: 3,
      imageConcurrency: 2,
      queueCapacity: 20,
      autoPauseOnLowMemory: false,
      lowMemoryThresholdGb: 3
    };
  }

  if (device.deviceTier === 'standard') {
    return {
      mode: 'balanced',
      totalTaskConcurrency: 2,
      renderConcurrency: 1,
      ttsConcurrency: 2,
      imageConcurrency: 1,
      queueCapacity: 15,
      autoPauseOnLowMemory: false,
      lowMemoryThresholdGb: 2
    };
  }

  return {
    mode: 'conservative',
    totalTaskConcurrency: 1,
    renderConcurrency: 1,
    ttsConcurrency: 1,
    imageConcurrency: 1,
    queueCapacity: 8,
    autoPauseOnLowMemory: false,
    lowMemoryThresholdGb: 1
  };
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numberValue)));
}

function sanitizeSettings(input: Partial<PerformanceSettings>, fallback: PerformanceSettings): PerformanceSettings {
  return {
    mode: input.mode === 'conservative' || input.mode === 'balanced' || input.mode === 'high' ? input.mode : fallback.mode,
    totalTaskConcurrency: clampInt(input.totalTaskConcurrency, fallback.totalTaskConcurrency, 1, 8),
    renderConcurrency: clampInt(input.renderConcurrency, fallback.renderConcurrency, 1, 3),
    ttsConcurrency: clampInt(input.ttsConcurrency, fallback.ttsConcurrency, 1, 8),
    imageConcurrency: clampInt(input.imageConcurrency, fallback.imageConcurrency, 1, 6),
    queueCapacity: clampInt(input.queueCapacity, fallback.queueCapacity, 1, 100),
    autoPauseOnLowMemory: typeof input.autoPauseOnLowMemory === 'boolean' ? input.autoPauseOnLowMemory : fallback.autoPauseOnLowMemory,
    lowMemoryThresholdGb: clampInt(input.lowMemoryThresholdGb, fallback.lowMemoryThresholdGb, 0, 32)
  };
}

export async function getPerformanceSettings() {
  const device = await getDeviceInfo();
  const recommended = recommendPerformanceSettings(device);
  try {
    const stored = await readJsonFile<Partial<PerformanceSettings>>(settingsPath);
    return {
      device,
      recommended,
      settings: sanitizeSettings(stored, recommended)
    };
  } catch {
    return {
      device,
      recommended,
      settings: recommended
    };
  }
}

export async function updatePerformanceSettings(input: Partial<PerformanceSettings>) {
  const current = await getPerformanceSettings();
  const settings = sanitizeSettings(input, current.recommended);
  await writeJsonFile(settingsPath, settings);
  return {
    ...current,
    settings
  };
}
