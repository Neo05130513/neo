import type { VideoScene } from './types';

export type SubtitleCue = {
  text: string;
  startSec: number;
  endSec: number;
};

function weightedLength(text: string) {
  return Array.from(text).reduce((total, char) => total + (/[\u4e00-\u9fff]/.test(char) ? 2 : 1), 0);
}

function stripWeakEndPunctuation(text: string) {
  return text.replace(/[，,、]\s*$/g, '');
}

function shouldMergeShortCue(previous: string | undefined, current: string, maxWeightedChars: number) {
  if (!previous) return false;
  const currentWeight = weightedLength(current);
  const previousWeight = weightedLength(previous);
  if (currentWeight <= 10) return weightedLength(previous + current) <= maxWeightedChars + 10;
  if (previousWeight <= 10) return weightedLength(previous + current) <= maxWeightedChars + 10;
  return false;
}

function balanceCueTail(chunks: string[], maxWeightedChars: number) {
  if (chunks.length < 2) return chunks;
  const result = [...chunks];
  const last = result[result.length - 1];
  const beforeLast = result[result.length - 2];
  if (weightedLength(last) <= 12 && weightedLength(beforeLast + last) <= maxWeightedChars + 12) {
    result.splice(result.length - 2, 2, beforeLast + last);
  }
  return result;
}

function splitLongPhrase(text: string, maxWeightedChars: number) {
  const chunks: string[] = [];
  let current = '';
  const softBreakChars = new Set(['，', ',', '、', '；', ';', ' ', '→', '-', '：', ':']);
  for (const char of Array.from(text)) {
    const next = current + char;
    if (current && weightedLength(next) > maxWeightedChars) {
      const chars = Array.from(current);
      let splitAt = -1;
      for (let index = chars.length - 1; index >= Math.max(0, chars.length - 14); index -= 1) {
        if (softBreakChars.has(chars[index])) {
          splitAt = index + 1;
          break;
        }
      }
      if (splitAt > 0 && splitAt < chars.length) {
        chunks.push(chars.slice(0, splitAt).join(''));
        current = chars.slice(splitAt).join('') + char;
        continue;
      }
      chunks.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return balanceCueTail(chunks, maxWeightedChars);
}

export function splitSubtitleText(text: string, maxWeightedChars = 34) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const rawParts = normalized
    .replace(/([。！？；!?;，,、])/g, '$1\n')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';
  for (const part of rawParts.length ? rawParts : [normalized]) {
    if (weightedLength(part) > maxWeightedChars) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (const chunk of splitLongPhrase(part, maxWeightedChars)) {
        if (shouldMergeShortCue(chunks[chunks.length - 1], chunk, maxWeightedChars)) {
          chunks[chunks.length - 1] += chunk;
        } else {
          chunks.push(chunk);
        }
      }
      continue;
    }

    const next = current ? `${current}${part}` : part;
    if (current && weightedLength(next) > maxWeightedChars) {
      chunks.push(current);
      current = part;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return balanceCueTail(chunks, maxWeightedChars).map(stripWeakEndPunctuation).filter(Boolean);
}

export function buildSubtitleCues(text: string, durationSec: number): SubtitleCue[] {
  const parts = splitSubtitleText(text);
  if (!parts.length) return [];

  const totalWeight = parts.reduce((total, part) => total + Math.max(1, weightedLength(part)), 0);
  const safeDuration = Math.max(0.8, durationSec);
  let cursor = 0;

  return parts.map((part, index) => {
    const isLast = index === parts.length - 1;
    const share = Math.max(1, weightedLength(part)) / totalWeight;
    const segmentDuration = isLast ? safeDuration - cursor : Math.max(0.45, safeDuration * share);
    const startSec = Number(cursor.toFixed(3));
    const endSec = Number((isLast ? safeDuration : Math.min(safeDuration, cursor + segmentDuration)).toFixed(3));
    cursor = endSec;
    return {
      text: part,
      startSec,
      endSec: Math.max(endSec, startSec + 0.25)
    };
  });
}

function formatSrtTime(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

export function buildProjectSrt(scenes: Array<Pick<VideoScene, 'voiceover' | 'durationSec'> & { subtitleCues?: SubtitleCue[] }>) {
  let index = 1;
  let sceneStart = 0;
  const blocks: string[] = [];

  for (const scene of scenes) {
    const cues = scene.subtitleCues?.length ? scene.subtitleCues : buildSubtitleCues(scene.voiceover, scene.durationSec);
    for (const cue of cues) {
      blocks.push([
        String(index),
        `${formatSrtTime(sceneStart + cue.startSec)} --> ${formatSrtTime(sceneStart + cue.endSec)}`,
        cue.text
      ].join('\n'));
      index += 1;
    }
    sceneStart += scene.durationSec;
  }

  return blocks.join('\n\n') + (blocks.length ? '\n' : '');
}
