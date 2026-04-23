import type { VideoProjectStatus } from '@/lib/types';

export function ProjectStatusBadge({ status }: { status: VideoProjectStatus }) {
  const map = {
    draft: ['#dbeafe', 'rgba(30,64,175,0.30)'],
    storyboarded: ['#ddd6fe', 'rgba(91,33,182,0.30)'],
    rendering: ['#fde68a', 'rgba(120,53,15,0.30)'],
    completed: ['#bbf7d0', 'rgba(20,83,45,0.32)'],
    failed: ['#fecaca', 'rgba(127,29,29,0.34)']
  } as const;

  const [color, background] = map[status];
  return <span style={{ color, background, borderRadius: 999, padding: '8px 12px', fontSize: 12, textTransform: 'uppercase' }}>{status}</span>;
}
