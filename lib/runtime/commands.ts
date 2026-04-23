import { execFile } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { getAppRoot } from './paths';

const execFileAsync = promisify(execFile);

function getBundledRemotionExecutable(command: string) {
  if (process.platform !== 'win32' || process.arch !== 'x64') return null;
  const executableName = command.endsWith('.exe') ? command : `${command}.exe`;
  const executablePath = path.join(
    getAppRoot(),
    'node_modules',
    '@remotion',
    'compositor-win32-x64-msvc',
    executableName
  );
  return existsSync(executablePath) ? executablePath : null;
}

export function getExecutablePath(command: string, envName: string) {
  return process.env[envName] || getBundledRemotionExecutable(command) || command;
}

export async function commandExists(command: string, envName: string) {
  try {
    await execFileAsync(getExecutablePath(command, envName), ['-version']);
    return true;
  } catch {
    return false;
  }
}
