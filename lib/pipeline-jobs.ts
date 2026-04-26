import { buildScriptShotBreakdown } from './script-shots';
import { processTutorialPipeline } from './pipeline';
import { nowIso, readJsonFile, simpleId, writeJsonFile } from './storage';
import type { PipelineJob, PipelineJobResult } from './types';

const PIPELINE_JOBS_PATH = 'data/pipeline-jobs.json';

type PipelineRuntimeStore = {
  controllers: Map<string, AbortController>;
  processing: boolean;
};

function getRuntimeStore() {
  const globalStore = globalThis as typeof globalThis & { __videoFactoryPipelineRuntime?: PipelineRuntimeStore };
  if (!globalStore.__videoFactoryPipelineRuntime) {
    globalStore.__videoFactoryPipelineRuntime = {
      controllers: new Map<string, AbortController>(),
      processing: false
    };
  }
  return globalStore.__videoFactoryPipelineRuntime;
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

async function readJobs() {
  try {
    return await readJsonFile<PipelineJob[]>(PIPELINE_JOBS_PATH);
  } catch {
    return [];
  }
}

async function writeJobs(jobs: PipelineJob[]) {
  await writeJsonFile(PIPELINE_JOBS_PATH, jobs);
}

function summarizeResult(result: Awaited<ReturnType<typeof processTutorialPipeline>>): PipelineJobResult {
  const firstScript = result.scripts[0];
  const firstScriptShots = firstScript
    ? buildScriptShotBreakdown(firstScript, result.tutorial).map((shot) => ({
      order: shot.order,
      title: shot.title,
      voiceover: shot.voiceover,
      subtitle: shot.subtitle,
      visualPrompt: shot.visualPrompt,
      durationSec: shot.durationSec
    }))
    : undefined;

  return {
    tutorialId: result.tutorial.id,
    tutorialTitle: result.tutorial.title,
    topicCount: result.topics.length,
    scriptCount: result.scripts.length,
    scripts: result.scripts.map((script) => ({
      id: script.id,
      title: script.title,
      hook: script.hook
    })),
    firstScriptId: firstScript?.id,
    firstScriptTitle: firstScript?.title,
    firstScriptShots
  };
}

async function updatePipelineJob(jobId: string, patch: Partial<PipelineJob>) {
  const jobs = await readJobs();
  const timestamp = patch.updatedAt || nowIso();
  let updated: PipelineJob | null = null;

  const nextJobs = jobs.map((job) => {
    if (job.id !== jobId) return job;
    updated = {
      ...job,
      ...patch,
      progress: typeof patch.progress === 'number' ? clampProgress(patch.progress) : job.progress,
      updatedAt: timestamp
    };
    return updated;
  });

  await writeJobs(nextJobs);
  return updated;
}

export async function enqueuePipelineJob(tutorialId: string) {
  const jobs = await readJobs();
  const existing = jobs.find((job) => job.tutorialId === tutorialId && (job.status === 'queued' || job.status === 'running'));
  if (existing) {
    // Older jobs may still reflect the retired multi-topic flow. Replace them
    // so a fresh request uses the current single-topic pipeline.
    if ((existing.totalTopics || 0) > 1) {
      await cancelPipelineJob(existing.id);
    } else {
      return existing;
    }
  }

  const now = nowIso();
  const job: PipelineJob = {
    id: simpleId('pipeline_job'),
    tutorialId,
    status: 'queued',
    stage: 'queued',
    progress: 4,
    detail: '任务已进入队列，等待开始。',
    createdAt: now,
    updatedAt: now
  };

  await writeJobs([job, ...jobs]);
  void processPipelineQueue();
  return job;
}

export async function getPipelineJob(jobId: string) {
  const jobs = await readJobs();
  return jobs.find((job) => job.id === jobId) || null;
}

export async function cancelPipelineJob(jobId: string) {
  const runtime = getRuntimeStore();
  const jobs = await readJobs();
  const current = jobs.find((job) => job.id === jobId);
  if (!current) return null;

  if (current.status === 'completed' || current.status === 'failed' || current.status === 'cancelled') {
    return current;
  }

  if (current.status === 'queued') {
    const cancelled: PipelineJob = {
      ...current,
      status: 'cancelled',
      stage: 'cancelled',
      progress: 100,
      detail: '用户已停止脚本生成。',
      error: '用户已停止脚本生成',
      completedAt: nowIso(),
      updatedAt: nowIso()
    };
    await writeJobs(jobs.map((job) => job.id === jobId ? cancelled : job));
    return cancelled;
  }

  const controller = runtime.controllers.get(jobId);
  controller?.abort('用户已停止脚本生成');
  return await updatePipelineJob(jobId, {
    stage: 'cancelling',
    detail: '正在停止脚本生成...',
    error: '用户已停止脚本生成'
  });
}

export async function processPipelineQueue() {
  const runtime = getRuntimeStore();
  if (runtime.processing) return null;

  const jobs = await readJobs();
  const nextJob = jobs.find((job) => job.status === 'queued');
  if (!nextJob) return null;

  runtime.processing = true;
  try {
    const controller = new AbortController();
    runtime.controllers.set(nextJob.id, controller);

    await updatePipelineJob(nextJob.id, {
      status: 'running',
      stage: 'starting',
      progress: Math.max(nextJob.progress, 8),
      startedAt: nowIso(),
      detail: '任务已开始，正在准备处理文档。',
      error: undefined
    });

    const result = await processTutorialPipeline(nextJob.tutorialId, {
      signal: controller.signal,
      onProgress: async (progress) => {
        await updatePipelineJob(nextJob.id, {
          stage: progress.stage,
          progress: progress.progress,
          detail: progress.detail,
          previewText: progress.previewText,
          currentTopicTitle: progress.currentTopicTitle,
          currentTopicIndex: progress.currentTopicIndex,
          totalTopics: progress.totalTopics,
          attempt: progress.attempt,
          maxAttempts: progress.maxAttempts,
          elapsedMs: progress.elapsedMs
        });
      }
    });

    const summary = summarizeResult(result);
    await updatePipelineJob(nextJob.id, {
      status: 'completed',
      stage: 'completed',
      progress: 100,
      detail: `已完成，生成 ${summary.scriptCount} 条脚本。`,
      result: summary,
      completedAt: nowIso(),
      error: undefined
    });
    return await getPipelineJob(nextJob.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : '教程处理失败';
    const controller = runtime.controllers.get(nextJob.id);
    if (controller?.signal.aborted || message === '用户已停止脚本生成') {
      await updatePipelineJob(nextJob.id, {
        status: 'cancelled',
        stage: 'cancelled',
        progress: 100,
        error: '用户已停止脚本生成',
        detail: '用户已停止脚本生成。',
        completedAt: nowIso()
      });
      return await getPipelineJob(nextJob.id);
    }

    await updatePipelineJob(nextJob.id, {
      status: 'failed',
      stage: 'failed',
      progress: 100,
      error: message,
      detail: message,
      completedAt: nowIso()
    });
    return await getPipelineJob(nextJob.id);
  } finally {
    runtime.controllers.delete(nextJob.id);
    runtime.processing = false;
    const latestJobs = await readJobs();
    if (latestJobs.some((job) => job.status === 'queued')) {
      void processPipelineQueue();
    }
  }
}
