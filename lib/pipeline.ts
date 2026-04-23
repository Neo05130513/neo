import { createHash } from 'crypto';
import { copyFile } from 'fs/promises';
import path from 'path';
import { extractTextFromFile } from './importers';
import { parseTutorial } from './parser';
import { generateTopics } from './topics';
import { generateScripts } from './scripts';
import { buildScriptShotBreakdown } from './script-shots';
import { ensureDirectory, nowIso, readJsonFile, simpleId, writeJsonFile } from './storage';
import { resolveDataPath, resolveRuntimePath, toPosixRelativePath } from './runtime/paths';
import { Script, SourceType, Topic, Tutorial } from './types';

interface ImportInput {
  sourceFile: string;
  sourceType: SourceType;
}

function normalizeTitleFromPath(sourceFile: string) {
  return path.basename(sourceFile).replace(/\.(docx|txt|md|html)$/i, '');
}

function contentHash(rawContent: string) {
  return createHash('sha1').update(rawContent).digest('hex');
}

function isDuplicateTutorial(existing: Tutorial[], sourceFile: string, rawContent: string) {
  const normalizedFile = path.resolve(resolveRuntimePath(sourceFile));
  const nextHash = contentHash(rawContent);

  return existing.find((tutorial) => {
    const sameFile = tutorial.sourceFile ? path.resolve(resolveRuntimePath(tutorial.sourceFile)) === normalizedFile : false;
    const sameHash = tutorial.tags.includes(`content-hash:${nextHash}`);
    const sameTitleAndSummary = tutorial.title === normalizeTitleFromPath(sourceFile) && tutorial.rawContent.slice(0, 200) === rawContent.slice(0, 200);
    return sameFile || sameHash || sameTitleAndSummary;
  });
}

async function copySourceFileIntoImports(tutorialId: string, sourceFile: string, sourceType: SourceType) {
  const ext = path.extname(sourceFile) || `.${sourceType}`;
  const relativePath = toPosixRelativePath(path.posix.join('data', 'imports', tutorialId, `source${ext.toLowerCase()}`));
  const absolutePath = resolveDataPath(relativePath);
  await ensureDirectory(path.dirname(absolutePath));
  await copyFile(resolveRuntimePath(sourceFile), absolutePath);
  return relativePath;
}

export async function importTutorials(inputs: ImportInput[]) {
  const tutorials = await readJsonFile<Tutorial[]>('data/tutorials.json');
  const created: Tutorial[] = [];
  const duplicates: { sourceFile: string; tutorialId: string; title: string }[] = [];

  for (const input of inputs) {
    const rawContent = await extractTextFromFile(input.sourceFile, input.sourceType);
    const duplicate = isDuplicateTutorial(tutorials, input.sourceFile, rawContent);

    if (duplicate) {
      duplicates.push({ sourceFile: input.sourceFile, tutorialId: duplicate.id, title: duplicate.title });
      continue;
    }

    const timestamp = nowIso();
    const tutorialId = simpleId('tutorial');
    const importedSourceFile = await copySourceFileIntoImports(tutorialId, input.sourceFile, input.sourceType);
    const tutorial: Tutorial = {
      id: tutorialId,
      title: normalizeTitleFromPath(input.sourceFile),
      sourceType: input.sourceType,
      sourceFile: importedSourceFile,
      rawContent,
      summary: '',
      targetAudience: [],
      scenarios: [],
      tools: [],
      methods: [],
      steps: [],
      keyQuotes: [],
      risks: [],
      categories: [],
      tags: [`content-hash:${contentHash(rawContent)}`, `source-name:${path.basename(input.sourceFile)}`],
      shortVideoScore: 0,
      priority: 'medium',
      status: 'imported',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    tutorials.unshift(tutorial);
    created.push(tutorial);
  }

  await writeJsonFile('data/tutorials.json', tutorials);
  return { created, duplicates };
}

export async function processTutorialPipeline(tutorialId: string) {
  const tutorials = await readJsonFile<Tutorial[]>('data/tutorials.json');
  const topics = await readJsonFile<Topic[]>('data/topics.json');
  const scripts = await readJsonFile<Script[]>('data/scripts.json');

  const tutorialIndex = tutorials.findIndex((item) => item.id === tutorialId);
  if (tutorialIndex === -1) {
    throw new Error('Tutorial not found');
  }

  const parsed = parseTutorial(tutorials[tutorialIndex]);
  tutorials[tutorialIndex] = parsed;

  const generatedTopics = generateTopics(parsed);
  const nextTopics = [...generatedTopics, ...topics.filter((item) => item.tutorialId !== tutorialId)];

  const generatedScripts = (await Promise.all(generatedTopics.map((topic) => generateScripts(topic, parsed)))).flat();
  const nextScripts = [...generatedScripts, ...scripts.filter((item) => item.tutorialId !== tutorialId)];

  await Promise.all([
    writeJsonFile('data/tutorials.json', tutorials),
    writeJsonFile('data/topics.json', nextTopics),
    writeJsonFile('data/scripts.json', nextScripts)
  ]);

  return {
    tutorial: parsed,
    topics: generatedTopics,
    scripts: generatedScripts,
    scriptShots: generatedScripts.map((script) => ({
      scriptId: script.id,
      shots: buildScriptShotBreakdown(script, parsed)
    }))
  };
}
