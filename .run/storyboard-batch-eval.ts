import { mkdir, writeFile } from 'fs/promises';
import { generateScripts } from '../lib/scripts';
import { createVideoProjectFromScriptWithOptions } from '../lib/videos';
import { readJsonFile, writeJsonFile } from '../lib/storage';
import type { Script, StoryboardReview, Topic, Tutorial } from '../lib/types';

type TopicSelection = {
  topicId: string;
  label: string;
};

const selections: TopicSelection[] = [
  { topicId: 'topic_1777037508064_vv3jnf', label: '脚本库样本 A：中小企业上AI第一步' },
  { topicId: 'topic_1776994206533_rhd3ow', label: '脚本库样本 B：老板AI焦虑的真正根源' },
  { topicId: 'topic_1777034705367_saoi6j', label: '脚本库样本 C：豆包×扣子引导孩子思考' }
];

async function main() {
  const [topics, tutorials, initialScripts] = await Promise.all([
    readJsonFile<Topic[]>('data/topics.json'),
    readJsonFile<Tutorial[]>('data/tutorials.json'),
    readJsonFile<Script[]>('data/scripts.json')
  ]);

  let scripts = initialScripts;
  const results: any[] = [];

  for (const selection of selections) {
    const topic = topics.find((item) => item.id === selection.topicId);
    if (!topic) {
      results.push({ label: selection.label, topicId: selection.topicId, error: 'Topic not found' });
      continue;
    }
    const tutorial = tutorials.find((item) => item.id === topic.tutorialId);
    if (!tutorial) {
      results.push({ label: selection.label, topicId: selection.topicId, error: 'Tutorial not found' });
      continue;
    }

    try {
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

      results.push({
        label: selection.label,
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
      });
    } catch (error) {
      results.push({
        label: selection.label,
        topic: { id: topic.id, title: topic.title },
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  await mkdir('.run', { recursive: true });
  await writeFile('.run/storyboard-batch-report.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log(JSON.stringify({
    selections: selections.map((item) => item.label),
    reportPath: '.run/storyboard-batch-report.json',
      results: results.map((item) => ({
        label: item.label,
        scriptId: item.script?.id,
        projectId: item.project?.id,
        score: item.project?.storyboardReview?.score,
        issues: item.project?.storyboardReview?.issues,
        reasons: item.project?.storyboardReview?.reasons,
        error: item.error
      }))
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
