'use server';

import { processTutorialPipeline } from '@/lib/pipeline';
import { getScripts, getTopics, getTutorials, getVideoProjects } from '@/lib/queries';
import { runAutoQualitySampling } from '@/lib/quality';
import { renderVideoProjectWithRemotion } from '@/lib/remotion-renderer';
import { createVideoProjectFromScript, createVideoProjectsBatch } from '@/lib/videos';

export async function processRecommendedTutorial(tutorialId?: string) {
  if (!tutorialId) return;
  await processTutorialPipeline(tutorialId);
}

export async function createRecommendedVideoProject(scriptId?: string) {
  if (!scriptId) return;
  await createVideoProjectFromScript(scriptId);
}

export async function renderRecommendedVideoProject(projectId?: string) {
  if (!projectId) return;
  await renderVideoProjectWithRemotion(projectId);
}

export async function fillContentGapBatch() {
  const [tutorials, topics] = await Promise.all([getTutorials(), getTopics()]);
  const targetIds = tutorials
    .filter((tutorial) => tutorial.status !== 'parsed' || !topics.some((topic) => topic.tutorialId === tutorial.id))
    .slice(0, 8)
    .map((tutorial) => tutorial.id);

  for (const tutorialId of targetIds) {
    await processTutorialPipeline(tutorialId);
  }
}

export async function pushScriptsToVideoBatch() {
  const [scripts, videoProjects] = await Promise.all([getScripts(), getVideoProjects()]);
  const targetScriptIds = scripts
    .filter((script) => !videoProjects.some((project) => project.scriptId === script.id))
    .slice(0, 10)
    .map((script) => script.id);

  if (targetScriptIds.length) {
    await createVideoProjectsBatch(targetScriptIds);
  }
}

export async function renderPendingVideoBatch() {
  const videoProjects = await getVideoProjects();
  const targetProjectIds = videoProjects
    .filter((project) => project.status === 'storyboarded' || project.status === 'draft' || project.status === 'failed')
    .slice(0, 8)
    .map((project) => project.id);

  for (const projectId of targetProjectIds) {
    await renderVideoProjectWithRemotion(projectId);
  }
}

export async function runQualitySamplingBatch() {
  await runAutoQualitySampling(5);
}
