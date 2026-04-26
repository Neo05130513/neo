export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { StudioShell } from '../_components/studio-shell';
import { EmptyGuide, linkButtonStyle, newWindowLinkProps, Panel, SectionTitle, StatusBadge, subtlePanelStyle } from '../_components/studio-ui';
import { getCurrentUser } from '@/lib/auth';
import { getScripts, getTutorials, getVideoAssets, getVideoProjects } from '@/lib/queries';
import { listVoiceProfiles } from '@/lib/voice-profiles';
import { ScriptAssetsClient } from './script-assets-client';
import { VoiceAssetsClient } from './voice-assets-client';

type AssetView = 'voices' | 'documents' | 'scripts' | 'outputs';

export default async function AssetsPage({ searchParams }: { searchParams?: { view?: AssetView } }) {
  const [user, tutorials, scripts, projects, assets] = await Promise.all([
    getCurrentUser(),
    getTutorials(),
    getScripts(),
    getVideoProjects(),
    getVideoAssets()
  ]);
  const voices = user ? (await listVoiceProfiles()).filter((profile) => profile.userId === user.id) : [];
  const activeView: AssetView = ['voices', 'documents', 'scripts', 'outputs'].includes(searchParams?.view || '')
    ? searchParams!.view as AssetView
    : 'voices';
  const outputAssets = assets.filter((asset) => ['image', 'video', 'audio', 'subtitle'].includes(asset.assetType));

  return (
    <StudioShell
      active="assets"
      title="我的素材"
      subtitle="管理你的声音、文档、脚本和输出文件。声音是正式制作视频前最重要的素材。"
      action={<Link href="/" {...newWindowLinkProps} style={linkButtonStyle('primary')}>开始制作</Link>}
    >
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        <MetricLink href="/assets" active={activeView === 'voices'} label="声音" value={`${voices.length}`} note="复刻音色" tone="#34d399" />
        <MetricLink href="/assets?view=documents" active={activeView === 'documents'} label="文档" value={`${tutorials.length}`} note="已导入资料" tone="#38bdf8" />
        <MetricLink href="/assets?view=scripts" active={activeView === 'scripts'} label="脚本" value={`${scripts.length}`} note="自动生成内容" tone="#a78bfa" />
        <MetricLink href="/assets?view=outputs" active={activeView === 'outputs'} label="输出" value={`${outputAssets.length}`} note="视频/音频/字幕" tone="#38bdf8" />
      </section>

      <Panel style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <SectionTitle title="素材列表" note="新用户优先关注声音和文档；脚本与输出保留给后续编辑和下载。" />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Tab href="/assets" active={activeView === 'voices'} text="声音" />
            <Tab href="/assets?view=documents" active={activeView === 'documents'} text="文档" />
            <Tab href="/assets?view=scripts" active={activeView === 'scripts'} text="脚本" />
            <Tab href="/assets?view=outputs" active={activeView === 'outputs'} text="输出" />
          </div>
        </div>

        {activeView === 'voices' ? <VoiceAssetsClient initialVoices={voices.map((voice) => ({
          id: voice.id,
          name: voice.name,
          provider: voice.provider,
          status: voice.status,
          isDefault: voice.isDefault,
          lastError: voice.lastError,
          samplePath: voice.samplePath,
          providerVoiceId: voice.providerVoiceId,
          createdAt: voice.createdAt
        }))} /> : null}
        {activeView === 'documents' ? <DocumentList tutorials={tutorials} projects={projects} /> : null}
        {activeView === 'scripts' ? <ScriptAssetsClient initialScripts={scripts} projects={projects} /> : null}
        {activeView === 'outputs' ? <OutputList assets={outputAssets} projects={projects} /> : null}
      </Panel>
    </StudioShell>
  );
}

function DocumentList({ tutorials, projects }: { tutorials: Awaited<ReturnType<typeof getTutorials>>; projects: Awaited<ReturnType<typeof getVideoProjects>> }) {
  if (!tutorials.length) return <EmptyGuide title="还没有文档" text="从开始制作页导入本地文档路径，系统会自动理解文档并生成视频。" href="/" action="导入文档" />;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {tutorials.slice(0, 80).map((tutorial) => {
        const count = projects.filter((project) => project.tutorialId === tutorial.id).length;
        return (
          <Link key={tutorial.id} href={`/tutorials/${tutorial.id}`} {...newWindowLinkProps} style={{ textDecoration: 'none', color: 'inherit', borderRadius: 10, border: '1px solid #243042', background: '#111823', padding: 14, display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center' }}>
            <div style={{ display: 'grid', gap: 5 }}>
              <strong>{tutorial.title}</strong>
              <span style={{ color: '#94a3b8', lineHeight: 1.5 }}>{tutorial.sourceFile || tutorial.sourceType}</span>
            </div>
            <StatusBadge text={`${count} 个视频`} tone={count ? 'success' : 'neutral'} />
          </Link>
        );
      })}
    </div>
  );
}

function OutputList({ assets, projects }: { assets: Awaited<ReturnType<typeof getVideoAssets>>; projects: Awaited<ReturnType<typeof getVideoProjects>> }) {
  if (!assets.length) return <EmptyGuide title="还没有输出文件" text="视频制作完成后，视频、音频和字幕文件会出现在这里。" />;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {assets.slice(0, 120).map((asset) => {
        const project = projects.find((item) => item.id === asset.projectId);
        const target = asset.path || `/videos/${asset.projectId}`;
        return (
          <a key={asset.id} href={target} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit', borderRadius: 10, border: '1px solid #243042', background: '#111823', padding: 14, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 14, alignItems: 'center' }}>
            <div style={{ display: 'grid', gap: 5 }}>
              <strong>{project?.title || asset.projectId}</strong>
              <span style={{ color: '#94a3b8', wordBreak: 'break-all' }}>{asset.path}</span>
              <span style={{ color: '#64748b', fontSize: 12 }}>{assetTypeLabel(asset.assetType)} · 点击查看</span>
            </div>
            <StatusBadge text={assetTypeLabel(asset.assetType)} tone={asset.status === 'ready' ? 'success' : 'warning'} />
          </a>
        );
      })}
    </div>
  );
}

function assetTypeLabel(type: string) {
  if (type === 'image') return '图片';
  if (type === 'video') return '视频';
  if (type === 'audio') return '音频';
  if (type === 'subtitle') return '字幕';
  return type;
}

function MetricLink({ href, active, label, value, note, tone }: { href: string; active: boolean; label: string; value: string; note: string; tone: string }) {
  return (
    <Link
      href={href}
      style={{
        ...subtlePanelStyle,
        padding: 14,
        display: 'grid',
        gap: 6,
        textDecoration: 'none',
        color: 'inherit',
        borderColor: active ? '#38bdf8' : '#243042',
        boxShadow: active ? '0 0 0 1px rgba(56,189,248,0.18)' : 'none',
        cursor: 'pointer'
      }}
    >
      <span style={{ color: '#8ea0b8', fontSize: 12 }}>{label}</span>
      <strong style={{ color: tone, fontSize: 24, lineHeight: 1.15 }}>{value}</strong>
      <span style={{ color: active ? '#bae6fd' : '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>{note} · 点击查看</span>
    </Link>
  );
}

function Tab({ href, active, text }: { href: string; active: boolean; text: string }) {
  return <Link href={href} {...newWindowLinkProps} style={{ textDecoration: 'none', borderRadius: 999, border: active ? '1px solid #38bdf8' : '1px solid #334155', background: active ? '#38bdf8' : '#1b2330', color: active ? '#061018' : '#cbd5e1', padding: '8px 12px', fontWeight: 800 }}>{text}</Link>;
}
