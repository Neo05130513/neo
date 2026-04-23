import { TrendMatch, Tutorial } from './types';

function splitKeyword(keyword: string) {
  return keyword
    .replace(/[\s、，,；;|/]+/g, ' ')
    .split(' ')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function mapTrendToTutorials(keyword: string, tutorials: Tutorial[]): TrendMatch[] {
  const lowered = keyword.toLowerCase();
  const parts = splitKeyword(keyword);

  return tutorials
    .map((tutorial) => {
      const haystacks = [tutorial.title, tutorial.summary, ...tutorial.tags, ...tutorial.categories, ...tutorial.tools].join(' ').toLowerCase();
      let score = 0;

      if (haystacks.includes(lowered)) score += 60;
      if (tutorial.rawContent.toLowerCase().includes(lowered)) score += 20;
      if (tutorial.tools.some((tool) => tool.toLowerCase().includes(lowered))) score += 15;
      if (tutorial.categories.some((item) => item.toLowerCase().includes(lowered))) score += 10;

      const partialHits = parts.filter((part) => haystacks.includes(part) || tutorial.rawContent.toLowerCase().includes(part));
      score += partialHits.length * 18;

      if (lowered.includes('ppt') && tutorial.categories.includes('AI办公提效')) score += 20;
      if (lowered.includes('ai') && tutorial.tags.some((tag) => tag.toLowerCase().includes('ai'))) score += 10;

      return {
        tutorialId: tutorial.id,
        tutorialTitle: tutorial.title,
        score,
        reasons: [
          tutorial.summary,
          tutorial.tools.length ? `相关工具：${tutorial.tools.join('、')}` : '',
          tutorial.methods.length ? `可切角度：${tutorial.methods.join('、')}` : '',
          partialHits.length ? `关键词命中：${partialHits.join('、')}` : ''
        ].filter(Boolean),
        suggestedAngles: ['痛点切入', '方法论拆解', '工具实操']
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}
