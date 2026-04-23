import { Topic, Tutorial } from './types';
import { nowIso, simpleId } from './storage';

const ANGLES = [
  { angle: '痛点型', hookType: '痛点开头' },
  { angle: '方法论型', hookType: '框架开头' },
  { angle: '工具实操型', hookType: '步骤开头' },
  { angle: '避坑型', hookType: '警告开头' },
  { angle: '进阶优化型', hookType: '升级开头' }
] as const;

function buildTitle(tutorial: Tutorial, angle: Topic['angle']) {
  const seed = tutorial.title.replace(/^如何/, '').replace(/。/g, '').trim();
  switch (angle) {
    case '痛点型':
      return `做${seed}时最容易踩的坑`;
    case '方法论型':
      return `${seed}的核心方法到底是什么`;
    case '工具实操型':
      return `用${tutorial.tools[0] || 'AI工具'}搞定${seed}`;
    case '避坑型':
      return `${seed}时千万别忽略这一步`;
    case '进阶优化型':
      return `让${seed}效果更好的3个技巧`;
  }
}

export function generateTopics(tutorial: Tutorial): Topic[] {
  const audience = tutorial.targetAudience[0] || 'AI内容创作者';
  const painPoint = tutorial.risks[0] || tutorial.summary;

  return ANGLES.map(({ angle, hookType }, index) => ({
    id: simpleId('topic'),
    tutorialId: tutorial.id,
    title: buildTitle(tutorial, angle),
    angle,
    hookType,
    painPoint,
    audience,
    platformFit: ['document'],
    viralScore: Math.max(70, tutorial.shortVideoScore - index * 3),
    createdAt: nowIso()
  }));
}
