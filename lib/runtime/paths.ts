import path from 'path';

export function getAppRoot() {
  return process.env.VIDEO_FACTORY_APP_ROOT || process.cwd();
}

export function getDataRoot() {
  return process.env.VIDEO_FACTORY_DATA_ROOT || path.join(getAppRoot(), 'data');
}

export function getGeneratedRoot() {
  return process.env.VIDEO_FACTORY_GENERATED_ROOT || path.join(getAppRoot(), 'public', 'generated');
}

export function toPosixRelativePath(relativePath: string) {
  return relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function isDataRelativePath(relativePath: string) {
  const normalized = toPosixRelativePath(relativePath);
  return normalized === 'data' || normalized.startsWith('data/');
}

export function resolveAppPath(relativePath: string) {
  if (path.isAbsolute(relativePath)) return relativePath;
  const normalized = toPosixRelativePath(relativePath);
  if (normalized === 'public/generated' || normalized.startsWith('public/generated/')) {
    const generatedRelative = normalized === 'public/generated' ? '' : normalized.slice('public/generated/'.length);
    return path.join(getGeneratedRoot(), generatedRelative);
  }
  return path.join(getAppRoot(), normalized);
}

export function resolveDataPath(relativePath = '') {
  if (path.isAbsolute(relativePath)) return relativePath;
  const normalized = toPosixRelativePath(relativePath);
  const dataRelative = normalized === 'data' ? '' : normalized.startsWith('data/') ? normalized.slice('data/'.length) : normalized;
  return path.join(getDataRoot(), dataRelative);
}

export function resolveRuntimePath(relativePath: string) {
  if (path.isAbsolute(relativePath)) return relativePath;
  return isDataRelativePath(relativePath) ? resolveDataPath(relativePath) : resolveAppPath(relativePath);
}

export function generatedRelativePath(...segments: string[]) {
  return path.posix.join('public', 'generated', ...segments.map(toPosixRelativePath));
}

export function publicPathFromRelative(relativePath: string) {
  const normalized = toPosixRelativePath(relativePath);
  const publicRelative = normalized.startsWith('public/') ? normalized.slice('public/'.length) : normalized;
  return `/${publicRelative}`;
}

export function publicPathForGenerated(...segments: string[]) {
  return publicPathFromRelative(generatedRelativePath(...segments));
}
