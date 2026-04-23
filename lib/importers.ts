import mammoth from 'mammoth';
import { readFile } from 'fs/promises';
import { SourceType } from './types';
import { resolveRuntimePath } from './runtime/paths';

function stripHtmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractTextFromFile(sourceFile: string, sourceType: SourceType) {
  const fullPath = resolveRuntimePath(sourceFile);

  if (sourceType === 'txt' || sourceType === 'md') {
    return await readFile(fullPath, 'utf-8');
  }

  if (sourceType === 'html') {
    const html = await readFile(fullPath, 'utf-8');
    return stripHtmlToText(html);
  }

  if (sourceType === 'docx') {
    const result = await mammoth.extractRawText({ path: fullPath });
    return result.value;
  }

  throw new Error(`Unsupported source type: ${sourceType}`);
}
