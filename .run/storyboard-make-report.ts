import { writeFile } from 'fs/promises';
import { readJsonFile } from '../lib/storage';

async function main() {
  const results = await readJsonFile<any[]>('.run/storyboard-batch-report.json');
  const lines: string[] = ['# Storyboard Batch Eval', ''];

  for (const item of results) {
    lines.push(`## ${item.label}`);
    lines.push('');
    lines.push(`- Topic: ${item.topic?.title || item.topic?.id || 'N/A'}`);
    lines.push(`- Tutorial: ${item.tutorial?.title || item.tutorial?.id || 'N/A'}`);
    lines.push(`- Script ID: ${item.script?.id || 'N/A'}`);
    lines.push(`- Project ID: ${item.project?.id || 'N/A'}`);

    if (item.error) {
      lines.push(`- Error: ${item.error}`);
      lines.push('');
      continue;
    }

    lines.push(`- Review Score: ${item.project?.storyboardReview?.score ?? 'N/A'}`);
    lines.push(`- Review Issues: ${(item.project?.storyboardReview?.issues || []).join('；') || '无'}`);
    lines.push(`- Review Reasons: ${(item.project?.storyboardReview?.reasons || []).join('；') || '无'}`);
    lines.push('');
    lines.push('### Script');
    lines.push('');
    lines.push('```text');
    lines.push(`标题：${item.script?.title || ''}`);
    lines.push(`时长：${item.script?.duration || ''}`);
    lines.push(`Hook：${item.script?.hook || ''}`);
    lines.push('');
    lines.push(item.script?.body || '');
    lines.push('');
    lines.push(`CTA：${item.script?.cta || ''}`);
    lines.push('```');
    lines.push('');
    lines.push('### Storyboard');
    lines.push('');

    for (const scene of item.scenes || []) {
      lines.push(`- ${scene.order}. [${scene.shotType}/${scene.layout || ''}] ${scene.headline || ''}｜${scene.subtitle || ''}`);
    }

    lines.push('');
  }

  await writeFile('.run/storyboard-eval-results.md', lines.join('\n'), 'utf-8');
  console.log('.run/storyboard-eval-results.md');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
