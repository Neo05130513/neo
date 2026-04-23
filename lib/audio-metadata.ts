import { execFile } from 'child_process';
import { promisify } from 'util';
import { getExecutablePath } from './runtime/commands';

const execFileAsync = promisify(execFile);

async function getAudioDurationWithFfprobe(absolutePath: string) {
  const { stdout } = await execFileAsync(getExecutablePath('ffprobe', 'FFPROBE_PATH'), [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    absolutePath
  ]);
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`ffprobe did not return a valid duration for: ${absolutePath}`);
  }
  return duration;
}

export async function getAudioDurationSec(absolutePath: string) {
  try {
    const runtimeImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
    const [{ parseMedia }, { nodeReader }] = await Promise.all([
      runtimeImport('@remotion/media-parser'),
      runtimeImport('@remotion/media-parser/node')
    ]);
    const result = await parseMedia({
      src: absolutePath,
      reader: nodeReader,
      fields: {
        durationInSeconds: true
      },
      acknowledgeRemotionLicense: true
    });
    const duration = result.durationInSeconds;
    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
      return duration;
    }
  } catch {}

  try {
    return await getAudioDurationWithFfprobe(absolutePath);
  } catch {
    throw new Error(`Unable to read audio duration: ${absolutePath}`);
  }
}
