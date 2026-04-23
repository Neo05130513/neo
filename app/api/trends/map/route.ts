import { NextResponse } from 'next/server';
import { mapTrendToTutorials } from '@/lib/trends';
import { readJsonFile } from '@/lib/storage';
import { Tutorial } from '@/lib/types';

export async function POST(request: Request) {
  const body = await request.json();
  const keyword = body.keyword as string;

  if (!keyword) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 });
  }

  const tutorials = await readJsonFile<Tutorial[]>('data/tutorials.json');
  const matches = mapTrendToTutorials(keyword, tutorials);

  return NextResponse.json({ matches });
}
