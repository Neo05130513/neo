import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { appendAuditLog } from '@/lib/audit';
import { collectImportInputsFromDirectory, inferSourceType } from '@/lib/files';
import { importTutorials } from '@/lib/pipeline';
import { Tutorial } from '@/lib/types';

export async function POST(request: Request) {
  const auth = await requireApiRole(['content', 'video']);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const sourceFile = body.sourceFile as string | undefined;
  const sourceFiles = body.sourceFiles as string[] | undefined;
  const sourceType = body.sourceType as Tutorial['sourceType'] | undefined;
  const sourceDirectory = body.sourceDirectory as string | undefined;

  let inputs: { sourceFile: string; sourceType: Tutorial['sourceType'] }[] = [];

  if (sourceDirectory) {
    inputs = await collectImportInputsFromDirectory(sourceDirectory);
  } else if (Array.isArray(sourceFiles) && sourceFiles.length) {
    inputs = sourceFiles
      .map((file) => ({ sourceFile: file, sourceType: inferSourceType(file) }))
      .filter((item): item is { sourceFile: string; sourceType: Tutorial['sourceType'] } => Boolean(item.sourceType));
  } else if (sourceFile && sourceType) {
    inputs = [{ sourceFile, sourceType }];
  }

  if (!inputs.length) {
    return NextResponse.json({ error: 'Provide sourceFile + sourceType, sourceFiles, or sourceDirectory' }, { status: 400 });
  }

  const result = await importTutorials(inputs);
  await Promise.all((result.created || []).map((tutorial) => appendAuditLog({
    actor: auth.user,
    action: 'tutorial.import',
    targetType: 'tutorial',
    targetId: tutorial.id,
    summary: `导入教程：${tutorial.title}`
  })));
  return NextResponse.json(result);
}
