export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { newWindowLinkProps } from '../../_components/studio-ui';
import { sharedSurface } from '../../_components/top-nav';
import { WorkspaceShell } from '../../_components/workspace-shell';
import { listAuditLogsByTarget } from '@/lib/audit';
import { canManageContent, requireUser } from '@/lib/auth';
import { getScripts, getTopics, getTutorials, getVideoProjects } from '@/lib/queries';

const shell = sharedSurface;

export default async function TutorialDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const { TutorialActions } = await import('./tutorial-actions');
  const [tutorials, topics, scripts, videoProjects] = await Promise.all([getTutorials(), getTopics(), getScripts(), getVideoProjects()]);
  const tutorial = tutorials.find((item) => item.id === params.id);

  if (!tutorial) {
    notFound();
  }

  const tutorialTopics = topics.filter((item) => item.tutorialId === tutorial.id);
  const tutorialScripts = scripts.filter((item) => item.tutorialId === tutorial.id);
  const tutorialProjects = videoProjects.filter((item) => item.tutorialId === tutorial.id);
  const tutorialAuditLogs = await listAuditLogsByTarget('tutorial', tutorial.id);
  const statusLabel = tutorialProjects.length === 0 ? '还没进入视频阶段' : tutorialProjects.some((item) => item.status === 'completed') ? '已有成片输出' : tutorialProjects.some((item) => item.status === 'rendering') ? '正在渲染中' : '已创建视频项目';

  return (
    <WorkspaceShell active="home" badge="教程详情" maxWidth={1180} background="linear-gradient(180deg, #0b1220 0%, #111827 100%)">
        <section style={{ ...shell, padding: 24 }}>
          <Link href="/" {...newWindowLinkProps} style={{ color: '#93c5fd', textDecoration: 'none' }}>← 返回首页</Link>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start', flexWrap: 'wrap', marginTop: 14 }}>
            <div style={{ maxWidth: 760 }}>
              <h1 style={{ margin: 0 }}>{tutorial.title}</h1>
              <p style={{ lineHeight: 1.8, color: '#cbd5e1', margin: '12px 0 0' }}>{tutorial.summary || '暂无摘要'}</p>
            </div>
            <div style={{ minWidth: 280, display: 'grid', gap: 12 }}>
              <div style={{ borderRadius: 18, padding: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: '#818cf8', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Production Status</div>
                <div style={{ marginTop: 10, fontSize: 24, fontWeight: 800 }}>{statusLabel}</div>
                <div style={{ marginTop: 8, color: '#cbd5e1', lineHeight: 1.75 }}>选题 {tutorialTopics.length} 条 · 脚本 {tutorialScripts.length} 条 · 视频项目 {tutorialProjects.length} 个</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href="/videos" {...newWindowLinkProps} style={{ textDecoration: 'none', padding: '12px 16px', borderRadius: 14, background: '#67e8f9', color: '#061018', fontWeight: 800 }}>推进到视频工厂</Link>
                <Link href="/scripts" {...newWindowLinkProps} style={{ textDecoration: 'none', padding: '12px 16px', borderRadius: 14, border: '1px solid rgba(148,163,184,0.14)', color: '#e5ecf7' }}>查看全部脚本</Link>
              </div>
              <div style={{ marginTop: 12 }}>
                {canManageContent(user.role) ? <TutorialActions tutorialId={tutorial.id} hasTopics={tutorialTopics.length > 0} hasScripts={tutorialScripts.length > 0} /> : <div style={{ color: '#94a3b8', lineHeight: 1.7 }}>当前账号为 {user.role}，只能查看教程详情，不能执行解析或完整流程。</div>}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginTop: 18 }}>
            <InfoBlock title="目标用户" items={tutorial.targetAudience} />
            <InfoBlock title="应用场景" items={tutorial.scenarios} />
            <InfoBlock title="使用工具" items={tutorial.tools} />
            <InfoBlock title="核心方法" items={tutorial.methods} />
            <InfoBlock title="可复用金句" items={tutorial.keyQuotes} />
            <InfoBlock title="风险提醒" items={tutorial.risks} />
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ ...shell, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <h2 style={{ marginTop: 0, marginBottom: 0 }}>操作审计</h2>
              <span style={{ color: '#94a3b8' }}>最近 {Math.min(tutorialAuditLogs.length, 12)} 条</span>
            </div>
            <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
              {tutorialAuditLogs.length === 0 ? <p>当前教程还没有操作记录</p> : tutorialAuditLogs.slice(0, 12).map((log) => (
                <article key={log.id} style={{ padding: 14, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <strong>{log.summary}</strong>
                    <span style={{ color: '#94a3b8' }}>{formatDate(log.createdAt)}</span>
                  </div>
                  <div style={{ marginTop: 8, color: '#93c5fd' }}>{log.actorName} · {log.actorRole}</div>
                  <div style={{ marginTop: 6, color: '#d1d5db' }}>{log.action}</div>
                </article>
              ))}
            </div>
          </div>

          <div style={{ ...shell, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <h2 style={{ marginTop: 0, marginBottom: 0 }}>选题列表</h2>
              <Link href="/topics" {...newWindowLinkProps} style={{ color: '#93c5fd', textDecoration: 'none' }}>查看全部选题 →</Link>
            </div>
            <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
              {tutorialTopics.length === 0 ? <p>暂未生成选题</p> : tutorialTopics.map((topic) => (
                <article key={topic.id} style={{ padding: 14, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <strong>{topic.title}</strong>
                  <div style={{ marginTop: 8, color: '#93c5fd' }}>{topic.angle} · {topic.hookType} · 爆款潜力 {topic.viralScore}</div>
                  <div style={{ marginTop: 8, color: '#d1d5db' }}>用途：文档讲解视频</div>
                </article>
              ))}
            </div>
          </div>

          <div style={{ ...shell, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <h2 style={{ marginTop: 0, marginBottom: 0 }}>脚本结果</h2>
              <Link href="/scripts" {...newWindowLinkProps} style={{ color: '#93c5fd', textDecoration: 'none' }}>查看全部脚本 →</Link>
            </div>
            <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
              {tutorialScripts.length === 0 ? <p>暂未生成脚本</p> : tutorialScripts.map((script) => (
                <article key={script.id} style={{ padding: 14, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <strong>{script.duration}</strong>
                  <div style={{ marginTop: 8 }}>标题：{script.title}</div>
                  <div style={{ marginTop: 8, color: '#d1d5db', whiteSpace: 'pre-wrap' }}>{script.hook}</div>
                </article>
              ))}
            </div>
          </div>
        </section>
    </WorkspaceShell>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div style={{ color: '#d1d5db', lineHeight: 1.8 }}>{items.length ? items.join('、') : '暂无'}</div>
    </div>
  );
}
