export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { newWindowLinkProps } from '../_components/studio-ui';
import { WorkspaceShell } from '../_components/workspace-shell';
import { MetricRow, QuickLink, StagePill, surfaceStyle } from '../_components/ui';
import { canManageContent, requireRole } from '@/lib/auth';
import { getTopics, getTutorials, getScripts, getVideoProjects } from '@/lib/queries';

const shell = surfaceStyle;

export default async function TopicsPage() {
  const user = await requireRole(['content']);
  const { TopicActions } = await import('./topic-actions');
  const [topics, tutorials, scripts, videoProjects] = await Promise.all([getTopics(), getTutorials(), getScripts(), getVideoProjects()]);
  const pendingScriptTopics = topics.filter((topic) => !scripts.some((item) => item.topicId === topic.id));
  const activeVideoTopics = topics.filter((topic) => videoProjects.some((item) => item.topicId === topic.id));

  return (
    <WorkspaceShell active="topics" badge="选题列表" maxWidth={1180}>
        <section style={{ ...shell, padding: 24, display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: 18 }}>
          <div>
            <div style={{ color: '#818cf8', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Topics</div>
            <h1 style={{ margin: '10px 0 0', fontSize: 42 }}>选题工作台</h1>
            <p style={{ margin: '12px 0 0', color: '#cbd5e1', lineHeight: 1.8, maxWidth: 760 }}>
              这里集中展示当前已经生成的选题，并直接告诉你哪些还没进入脚本、哪些已经开始进入视频，方便你快速判断下一步该推进哪一批。
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              <QuickLink href="/scripts" text="查看全部脚本" />
              <QuickLink href="/videos" text="去视频工厂" />
            </div>
          </div>
          <div style={{ borderRadius: 20, padding: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 12 }}>
            <MetricRow label="选题总数" value={`${topics.length}`} tone="#67e8f9" />
            <MetricRow label="待出脚本" value={`${pendingScriptTopics.length}`} tone="#fde68a" />
            <MetricRow label="已进视频" value={`${activeVideoTopics.length}`} tone="#86efac" />
            <MetricRow label="覆盖教程" value={`${new Set(topics.map((item) => item.tutorialId)).size}`} tone="#f9a8d4" />
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
          <StatCard label="选题总数" value={topics.length} />
          <StatCard label="已关联教程" value={new Set(topics.map((item) => item.tutorialId)).size} />
          <StatCard label="高爆款潜力" value={topics.filter((item) => item.viralScore >= 80).length} />
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FocusCard title="待推进到脚本" count={pendingScriptTopics.length} note="这些选题还没有对应脚本，适合优先推进。" />
          <FocusCard title="已进入视频" count={activeVideoTopics.length} note="这些选题已经不止停留在创意阶段。" />
        </section>

        <section style={{ ...shell, padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>选题结果</h2>
          <div style={{ display: 'grid', gap: 14 }}>
            {topics.length === 0 ? (
              <p style={{ color: '#cbd5e1' }}>还没有选题数据，建议先在首页查看教程并推进处理流程。</p>
            ) : (
              topics.map((topic) => {
                const tutorial = tutorials.find((item) => item.id === topic.tutorialId);
                const topicScripts = scripts.filter((item) => item.topicId === topic.id);
                const topicProjects = videoProjects.filter((item) => item.topicId === topic.id);
                return (
                  <article key={topic.id} style={{ borderRadius: 20, padding: 20, background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(15,23,42,0.28) 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 16px 36px rgba(2,6,23,0.16)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          <strong style={{ fontSize: 18 }}>{topic.title}</strong>
                          <StagePill text={topicScripts.length ? '已出脚本' : '待出脚本'} tone={topicScripts.length ? '#bbf7d0' : '#fde68a'} bg={topicScripts.length ? 'rgba(34,197,94,0.14)' : 'rgba(245,158,11,0.14)'} />
                          <StagePill text={topicProjects.length ? '已进视频' : '未进视频'} tone={topicProjects.length ? '#67e8f9' : '#cbd5e1'} bg={topicProjects.length ? 'rgba(6,182,212,0.14)' : 'rgba(148,163,184,0.12)'} />
                        </div>
                        <div style={{ marginTop: 8, color: '#93c5fd' }}>{topic.angle} · {topic.hookType} · 爆款潜力 {topic.viralScore}</div>
                        <div style={{ marginTop: 8, color: '#cbd5e1' }}>痛点：{topic.painPoint}</div>
                        <div style={{ marginTop: 8, color: '#cbd5e1' }}>用途：文档讲解视频</div>
                        <div style={{ marginTop: 8, color: '#cbd5e1' }}>关联教程：{tutorial?.title || '未知教程'}</div>
                        <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 14 }}>脚本 {topicScripts.length} 条 · 视频项目 {topicProjects.length} 个</div>
                        <div style={{ marginTop: 14 }}>
                          {canManageContent(user.role) ? <TopicActions topicId={topic.id} tutorialId={topic.tutorialId} hasScripts={topicScripts.length > 0} /> : <div style={{ color: '#94a3b8', lineHeight: 1.7 }}>当前账号为 {user.role}，只能查看选题，不能生成脚本。</div>}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                        {tutorial ? <Link href={`/tutorials/${tutorial.id}`} {...newWindowLinkProps} style={{ color: '#93c5fd', textDecoration: 'none' }}>查看教程详情 →</Link> : null}
                        {topicScripts.length ? <Link href="/scripts" {...newWindowLinkProps} style={{ color: '#67e8f9', textDecoration: 'none' }}>查看关联脚本 →</Link> : null}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
    </WorkspaceShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return <div style={{ ...shell, padding: 20 }}><div style={{ color: '#94a3b8', fontSize: 14 }}>{label}</div><div style={{ marginTop: 8, fontSize: 36, fontWeight: 800 }}>{value}</div></div>;
}
function FocusCard({ title, count, note }: { title: string; count: number; note: string }) {
  return <div style={{ ...shell, padding: 20 }}><div style={{ color: '#818cf8', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{title}</div><div style={{ marginTop: 10, fontSize: 34, fontWeight: 800 }}>{count}</div><div style={{ marginTop: 8, color: '#cbd5e1', lineHeight: 1.7 }}>{note}</div></div>;
}
