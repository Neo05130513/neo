import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type DeviceInfo = {
  platform: NodeJS.Platform;
  arch: string;
  cpuModel: string;
  cpuCores: number;
  cpuThreads: number;
  totalMemoryGb: number;
  freeMemoryGb: number;
  gpuModels: string[];
  deviceTier: 'basic' | 'standard' | 'pro' | 'workstation';
};

let cachedDeviceInfo: { value: DeviceInfo; expiresAt: number } | null = null;

function gb(value: number) {
  return Math.round((value / 1024 / 1024 / 1024) * 10) / 10;
}

async function getMacGpus() {
  try {
    const { stdout } = await execFileAsync('system_profiler', ['SPDisplaysDataType'], { timeout: 4000 });
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('Chipset Model:') || line.startsWith('Graphics/Displays:'))
      .map((line) => line.replace(/^Chipset Model:\s*/, '').replace(/^Graphics\/Displays:\s*/, '').trim())
      .filter((line) => line && line !== 'Graphics/Displays:');
  } catch {
    return [];
  }
}

async function getWindowsGpus() {
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', 'Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name'], { timeout: 4000 });
    return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function getGpuModels(platform: NodeJS.Platform) {
  if (platform === 'darwin') return getMacGpus();
  if (platform === 'win32') return getWindowsGpus();
  return [];
}

function inferTier(cpuThreads: number, memoryGb: number, gpuModels: string[]) {
  const hasDiscreteGpu = gpuModels.some((gpu) => /nvidia|geforce|rtx|gtx|radeon|arc/i.test(gpu));
  if (cpuThreads >= 24 && memoryGb >= 48 && hasDiscreteGpu) return 'workstation' as const;
  if (cpuThreads >= 16 && memoryGb >= 32) return 'pro' as const;
  if (cpuThreads >= 8 && memoryGb >= 16) return 'standard' as const;
  return 'basic' as const;
}

export async function getDeviceInfo(): Promise<DeviceInfo> {
  if (cachedDeviceInfo && cachedDeviceInfo.expiresAt > Date.now()) return cachedDeviceInfo.value;

  const cpus = os.cpus();
  const platform = process.platform;
  const totalMemoryGb = gb(os.totalmem());
  const gpuModels = await getGpuModels(platform);
  const cpuThreads = typeof os.availableParallelism === 'function' ? os.availableParallelism() : cpus.length;

  const value = {
    platform,
    arch: process.arch,
    cpuModel: cpus[0]?.model || 'Unknown CPU',
    cpuCores: cpus.length,
    cpuThreads,
    totalMemoryGb,
    freeMemoryGb: gb(os.freemem()),
    gpuModels,
    deviceTier: inferTier(cpuThreads, totalMemoryGb, gpuModels)
  };
  cachedDeviceInfo = { value, expiresAt: Date.now() + 60_000 };
  return value;
}
