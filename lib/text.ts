function normalizeWhitespace(input: string) {
  return input.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

export function summarizeContent(raw: string) {
  const lines = normalizeWhitespace(raw).split('\n').filter(Boolean);
  return lines.slice(0, 3).join(' ');
}

export function extractSections(raw: string) {
  const lines = normalizeWhitespace(raw).split('\n').map((line) => line.trim()).filter(Boolean);
  return lines;
}

export function keywordIncludes(raw: string, keywords: string[]) {
  const text = raw.toLowerCase();
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}
