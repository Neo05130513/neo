import path from 'path';
import { ensureDirectory, nowIso, readJsonFile, simpleId, writeJsonFile, writeTextFile } from './storage';
import { getAudioDurationSec } from './audio-metadata';
import { buildProjectSrt, buildSubtitleCues } from './subtitles';
import { generateSceneVoiceAudio } from './voice-provider';
import { getDefaultVoiceProfile } from './voice-profiles';
import { generatedRelativePath, publicPathFromRelative, resolveAppPath } from './runtime/paths';
import type { Script, Topic, Tutorial, VideoAsset, VideoProject, VideoScene } from './types';
import type { RemotionVideoInput } from '@/remotion/types';

function getCompositionId(template: string) {
  return template === 'tech-explainer-v1' ? 'TechExplainer' : 'TutorialDemo';
}

async function loadRemotionModules() {
  try {
    const runtimeImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<any>;
    const [{ bundle }, { renderMedia, selectComposition }] = await Promise.all([
      runtimeImport('@remotion/bundler'),
      runtimeImport('@remotion/renderer')
    ]);
    return { bundle, renderMedia, selectComposition };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Remotion dependencies are not installed or not resolvable yet: ${message}`);
  }
}

async function readVideoState() {
  const [projects, scenes, assets, scripts, topics, tutorials] = await Promise.all([
    readJsonFile<VideoProject[]>('data/video-projects.json'),
    readJsonFile<VideoScene[]>('data/video-scenes.json'),
    readJsonFile<VideoAsset[]>('data/video-assets.json'),
    readJsonFile<Script[]>('data/scripts.json'),
    readJsonFile<Topic[]>('data/topics.json'),
    readJsonFile<Tutorial[]>('data/tutorials.json')
  ]);

  return { projects, scenes, assets, scripts, topics, tutorials };
}

function toRemotionInput(project: VideoProject, scenes: VideoScene[], audioBySceneId: Map<string, { publicPath: string; durationSec: number }>): RemotionVideoInput {
  return {
    project: {
      id: project.id,
      title: project.title,
      template: project.template,
      aspectRatio: project.aspectRatio,
      visualPreset: project.visualPreset
    },
    scenes: scenes.map((scene) => ({
      id: scene.id,
      order: scene.order,
      shotType: scene.shotType,
      visualType: scene.visualType,
      visualPrompt: scene.visualPrompt,
      voiceover: scene.voiceover,
      subtitle: scene.subtitle,
      durationSec: audioBySceneId.get(scene.id)?.durationSec || scene.durationSec,
      audioPath: audioBySceneId.get(scene.id)?.publicPath,
      audioDurationSec: audioBySceneId.get(scene.id)?.durationSec,
      layout: scene.layout,
      headline: scene.headline,
      emphasis: scene.emphasis,
      keywords: scene.keywords,
      cards: scene.cards,
      chartData: scene.chartData,
      transition: scene.transition,
      subtitleCues: buildSubtitleCues(scene.voiceover, audioBySceneId.get(scene.id)?.durationSec || scene.durationSec)
    }))
  };
}

function updateProjectFailure(project: VideoProject, message: string): VideoProject {
  return {
    ...project,
    status: 'failed',
    outputPath: undefined,
    lastError: message,
    lastRenderAttemptAt: nowIso(),
    updatedAt: nowIso(),
    publishScore: 0,
    publishTier: 'blocked'
  };
}

function evaluateRemotionPublishability(scenes: VideoScene[]) {
  const sceneScore = scenes.length >= 6 ? 22 : scenes.length >= 4 ? 16 : 8;
  const durationScore = scenes.reduce((total, scene) => total + scene.durationSec, 0) >= 20 ? 18 : 10;
  const subtitleScore = scenes.every((scene) => scene.subtitle.trim()) ? 18 : 8;
  const visualPromptScore = scenes.every((scene) => scene.visualPrompt.trim()) ? 12 : 4;
  const renderScore = 40;
  const publishScore = Math.min(100, renderScore + sceneScore + durationScore + subtitleScore + visualPromptScore);
  return {
    publishScore,
    publishTier: publishScore >= 80 ? 'publishable' as const : publishScore >= 60 ? 'review' as const : 'blocked' as const
  };
}

async function prepareSceneAudio(params: {
  projectId: string;
  scenes: VideoScene[];
  existingAssets: VideoAsset[];
}) {
  const profile = await getDefaultVoiceProfile();
  const audioBySceneId = new Map<string, { publicPath: string; durationSec: number }>();
  const createdAssets: VideoAsset[] = [];

  if (!profile) {
    return { audioBySceneId, createdAssets, scenes: params.scenes };
  }

  for (const scene of params.scenes) {
    const generated = await generateSceneVoiceAudio({
      profile,
      projectId: params.projectId,
      sceneId: scene.id,
      order: scene.order,
      text: scene.voiceover
    });
    const durationSec = await getAudioDurationSec(generated.absolutePath);
    audioBySceneId.set(scene.id, {
      publicPath: generated.publicPath,
      durationSec
    });
    createdAssets.push({
      id: simpleId('video_asset'),
      projectId: params.projectId,
      sceneId: scene.id,
      assetType: 'audio',
      path: generated.publicPath,
      status: 'ready'
    });
  }

  const scenes = params.scenes.map((scene) => {
    const audio = audioBySceneId.get(scene.id);
    if (!audio) return scene;
    return {
      ...scene,
      durationSec: Math.max(1, Number(audio.durationSec.toFixed(2)))
    };
  });

  return { audioBySceneId, createdAssets, scenes };
}

export async function renderVideoProjectWithRemotion(projectId: string) {
  const state = await readVideoState();
  const projectIndex = state.projects.findIndex((item) => item.id === projectId);
  if (projectIndex === -1) throw new Error('Video project not found');

  const project = state.projects[projectIndex];
  const projectScenes = state.scenes
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => a.order - b.order);

  if (!projectScenes.length) throw new Error('No storyboard scenes found');

  const renderingProject: VideoProject = {
    ...project,
    status: 'rendering',
    outputPath: undefined,
    lastError: undefined,
    lastRenderAttemptAt: nowIso(),
    updatedAt: nowIso()
  };
  state.projects[projectIndex] = renderingProject;
  await writeJsonFile('data/video-projects.json', state.projects);

  try {
    const preparedAudio = await prepareSceneAudio({
      projectId,
      scenes: projectScenes,
      existingAssets: state.assets
    });
    const renderScenes = preparedAudio.scenes;
    const inputProps = toRemotionInput(renderingProject, renderScenes, preparedAudio.audioBySceneId);
    const outputRelativePath = generatedRelativePath('remotion', projectId, 'output.mp4');
    const inputRelativePath = generatedRelativePath('remotion', projectId, 'input.json');
    const subtitleRelativePath = generatedRelativePath('remotion', projectId, 'subtitles.srt');
    const outputAbsolutePath = resolveAppPath(outputRelativePath);

    await ensureDirectory(path.dirname(outputAbsolutePath));
    await writeTextFile(inputRelativePath, JSON.stringify(inputProps, null, 2) + '\n');
    await writeTextFile(subtitleRelativePath, buildProjectSrt(inputProps.scenes));

    const { bundle, renderMedia, selectComposition } = await loadRemotionModules();
    const serveUrl = await bundle({
      entryPoint: resolveAppPath('remotion/index.tsx')
    });
    const composition = await selectComposition({
      serveUrl,
      id: getCompositionId(renderingProject.template),
      inputProps: inputProps as unknown as Record<string, unknown>
    });

    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outputAbsolutePath,
      inputProps: inputProps as unknown as Record<string, unknown>
    });

    const publicOutputPath = publicPathFromRelative(outputRelativePath);
    const publicSubtitlePath = publicPathFromRelative(subtitleRelativePath);
    const nextAssets = state.assets.filter((item) => item.projectId !== projectId);
    const createdAssets: VideoAsset[] = [
      ...preparedAudio.createdAssets,
      {
        id: simpleId('video_asset'),
        projectId,
        sceneId: renderScenes[0].id,
        assetType: 'video',
        path: publicOutputPath,
        status: 'ready'
      },
      {
        id: simpleId('video_asset'),
        projectId,
        sceneId: renderScenes[0].id,
        assetType: 'subtitle',
        path: publicSubtitlePath,
        status: 'ready'
      }
    ];
    const publishability = evaluateRemotionPublishability(renderScenes);
    const completedProject: VideoProject = {
      ...renderingProject,
      status: 'completed',
      outputPath: publicOutputPath,
      updatedAt: nowIso(),
      lastError: undefined,
      publishScore: publishability.publishScore,
      publishTier: publishability.publishTier
    };

    state.projects[projectIndex] = completedProject;
    await Promise.all([
      writeJsonFile('data/video-projects.json', state.projects),
      writeJsonFile('data/video-assets.json', [...createdAssets, ...nextAssets]),
      writeJsonFile('data/video-scenes.json', [
        ...renderScenes,
        ...state.scenes.filter((scene) => scene.projectId !== projectId)
      ])
    ]);

    return {
      project: completedProject,
      scenes: renderScenes,
      assets: createdAssets,
      remotionReady: true,
      outputPath: publicOutputPath,
      inputProps
    };
  } catch (error) {
    const failedProject = updateProjectFailure(renderingProject, error instanceof Error ? error.message : 'Remotion render failed');
    state.projects[projectIndex] = failedProject;
    await writeJsonFile('data/video-projects.json', state.projects);
    throw error;
  }
}
