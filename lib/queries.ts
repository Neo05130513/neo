import { readJsonFile } from './storage';
import { getRuntimeStatus } from './runtime/environment';
import { Script, StoryboardReview, Topic, Tutorial, VideoAsset, VideoProject, VideoScene } from './types';

export async function getTutorials() {
  return readJsonFile<Tutorial[]>('data/tutorials.json');
}

export async function getTopics() {
  return readJsonFile<Topic[]>('data/topics.json');
}

export async function getScripts() {
  return readJsonFile<Script[]>('data/scripts.json');
}

export async function getVideoProjects() {
  return readJsonFile<VideoProject[]>('data/video-projects.json');
}

export async function getVideoScenes() {
  return readJsonFile<VideoScene[]>('data/video-scenes.json');
}

export async function getVideoAssets() {
  return readJsonFile<VideoAsset[]>('data/video-assets.json');
}

export async function getVideoRuntimeStatus() {
  return getRuntimeStatus();
}

export async function getRenderJobs() {
  return readJsonFile<import('./types').RenderJob[]>('data/render-jobs.json');
}

export async function getQualityReviews() {
  return readJsonFile<import('./types').QualityReview[]>('data/quality-reviews.json');
}

export async function getStoryboardReviews() {
  try {
    return await readJsonFile<StoryboardReview[]>('data/storyboard-reviews.json');
  } catch {
    return [];
  }
}
