import { NextResponse } from 'next/server';
import { buildScriptExportText } from '@/lib/script-ops';
import { readJsonFile } from '@/lib/storage';
import type { Script } from '@/lib/types';

export async function GET(_: Request, context: { params: { id: string } }) {
  const scripts = await readJsonFile<Script[]>('data/scripts.json');
  const script = scripts.find((item) => item.id === context.params.id);

  if (!script) {
    return NextResponse.json({ error: 'Script not found' }, { status: 404 });
  }

  const text = buildScriptExportText(script);
  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(script.title)}.txt"`
    }
  });
}
