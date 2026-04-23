import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { getGeneratedRoot, toPosixRelativePath } from '@/lib/runtime/paths';

function contentTypeFor(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.mp3') return 'audio/mpeg';
  if (extension === '.wav') return 'audio/wav';
  if (extension === '.srt') return 'text/plain; charset=utf-8';
  if (extension === '.json') return 'application/json; charset=utf-8';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

export async function GET(_request: Request, { params }: { params: { path?: string[] } }) {
  const relativePath = toPosixRelativePath((params.path || []).join('/'));
  if (!relativePath || relativePath.split('/').includes('..')) {
    return NextResponse.json({ error: 'Invalid generated asset path' }, { status: 400 });
  }

  const generatedRoot = getGeneratedRoot();
  const filePath = path.resolve(generatedRoot, relativePath);
  const rootPath = path.resolve(generatedRoot);
  if (filePath !== rootPath && !filePath.startsWith(rootPath + path.sep)) {
    return NextResponse.json({ error: 'Invalid generated asset path' }, { status: 400 });
  }

  try {
    const file = await readFile(filePath);
    return new NextResponse(file, {
      headers: {
        'Content-Type': contentTypeFor(filePath),
        'Cache-Control': 'no-store'
      }
    });
  } catch {
    return NextResponse.json({ error: 'Generated asset not found' }, { status: 404 });
  }
}
