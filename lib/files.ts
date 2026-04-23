import { readdir } from 'fs/promises';
import path from 'path';
import { SourceType } from './types';

const SUPPORTED_EXTENSIONS = new Map<string, SourceType>([
  ['.docx', 'docx'],
  ['.txt', 'txt'],
  ['.md', 'md'],
  ['.html', 'html']
]);

export function inferSourceType(filePath: string): SourceType | null {
  return SUPPORTED_EXTENSIONS.get(path.extname(filePath).toLowerCase()) ?? null;
}

async function walkDirectory(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await walkDirectory(fullPath)));
      continue;
    }

    if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
}

export async function collectImportInputsFromDirectory(directory: string) {
  const files = await walkDirectory(directory);
  return files
    .map((filePath) => ({ sourceFile: filePath, sourceType: inferSourceType(filePath) }))
    .filter((item): item is { sourceFile: string; sourceType: SourceType } => Boolean(item.sourceType));
}
