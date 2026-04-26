import { generateScripts } from '../lib/scripts';
import { createVideoProjectFromScriptWithOptions } from '../lib/videos';
import { readJsonFile, writeJsonFile } from '../lib/storage';
import type { Script, StoryboardReview, Topic, Tutorial } from '../lib/types';

async function main() {
  const topicId = process.argv[2];
  if (!topicId) {
    throw new Error('Usage: npx tsx .run/storyboard-eval-one.ts <topicId>');
  }

  const [topics, tutorials, initialScripts] = await Promise.all([
    readJsonFile<Topic[]>('data/topics.json'),
    readJsonFile<Tutorial[]>('data/tutorials.json'),
    readJsonFile<Script[]>('data/scripts.json')
  ]);

  const topic = topics.find((item) => item.id === topicId);
  if (!topic) throw new Error(`Topic not found: ${topicId}`);
  const tutorial = tutorials.find((item) => item.id === topic.tutorialId);
  if (!tutorial) throw new Error(`Tutorial not found for topic: ${topicId}`);

  let scripts = initialScripts;
  let script = scripts.find((item) => item.topicId === topic.id);
  let scriptSource: 'existing' | 'generated' = 'existing';
  if (!script) {
    const generated = await generateScripts(topic, tutorial);
    script = generated[0];
    scripts = [script, ...scripts.filter((item) => item.topicId !== topic.id)];
    await writeJsonFile('data/scripts.json', scripts);
    scriptSource = 'generated';
  }

  const projectResult = await createVideoProjectFromScriptWithOptions(script.id, {
    aspectRatio: '9:16',
    template: 'ai-explainer-short-v1'
  });

  const reviews = await readJsonFile<StoryboardReview[]>('data/storyboard-reviews.json');
  const review = reviews.find((item) => item.projectId === projectResult.project.id);

  console.log(JSON.stringify({
    topic: {
      id: topic.id,
      title: topic.title,
      angle: topic.angle,
      audience: topic.audience
    },
    tutorial: {
      id: tutorial.id,
      title: tutorial.title,
      summary: tutorial.summary
    },
    scriptSource,
    script: {
      id: script.id,
      title: script.title,
      duration: script.duration,
      hook: script.hook,
      body: script.body,
      cta: script.cta,
      style: script.style
    },
    project: {
      id: projectResult.project.id,
      title: projectResult.project.title,
      sceneCount: projectResult.scenes.length,
      storyboardReview: review
        ? {
          score: review.score,
          issues: review.issues,
          reasons: review.reasons || [],
          createdAt: review.createdAt
        }
        : null
    },
    scenes: projectResult.scenes.map((scene) => ({
      order: scene.order,
      shotType: scene.shotType,
      layout: scene.layout,
      headline: scene.headline,
      subtitle: scene.subtitle,
      emphasis: scene.emphasis,
      cards: scene.cards,
      keywords: scene.keywords
    }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
