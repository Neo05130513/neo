export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { StudioShell } from '../_components/studio-shell';
import { EmptyGuide, linkButtonStyle, MetricTile, newWindowLinkProps, Panel, SectionTitle, StatusBadge, subtlePanelStyle } from '../_components/studio-ui';
import { getScripts, getTutorials, getVideoProjects } from '@/lib/queries';

export default async function ScriptsPage() {
  const [scripts, tutorials, projects] = await Promise.all([
    getScripts(),
    getTutorials(),
    getVideoProjects()
  ]);

  const scriptsWithVideo = scripts.filter((script) => projects.some((project) => project.scriptId === script.id));
  const scriptsWithoutVideo = scripts.filter((script) => !projects.some((project) => project.scriptId === script.id));
  const latestScripts = [...scripts].sort((a, b) => Number(new Date(b.createdAt)) - Number(new Date(a.createdAt))).slice(0, 80);

  return (
    <StudioShell
      active="assets"
      title="脚本"
      subtitle="这里保持简单：看脚本、改脚本、把脚本继续生成视频。复杂的版本对比和后台信息先不展示。"
      action={<Link href="/" {...newWindowLinkProps} style={linkButtonStyle('primary')}>回到开始制作</Link>}
    >
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        <MetricTile label="全部脚本" value={`${scripts.length}`} note="已生成内容" />
        <MetricTile label="未生成视频" value={`${scriptsWithoutVideo.length}`} note="下一步优先处理" tone="#fbbf24" />
        <MetricTile label="已有视频" value={`${scriptsWithVideo.length}`} note="可继续修改" tone="#34d399" />
        <MetricTile label="来源文档" value={`${new Set(scripts.map((script) => script.tutorialId)).size}`} note="覆盖资料" tone="#38bdf8" />
      </section>

      <Panel style={{ display: 'grid', gap: 16 }}>
        <SectionTitle title="脚本列表" note="点击打开脚本详情，新窗口中修改或生成视频，当前页面不会被替换。" />
        {latestScripts.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {latestScripts.map((script) => {
              const tutorial = tutorials.find((item) => item.id === script.tutorialId);
              const relatedProjects = projects.filter((project) => project.scriptId === script.id);
              return (
                <Link
                  key={script.id}
                  href={`/scripts/${script.id}`}
                  {...newWindowLinkProps}
                  style={{ ...subtlePanelStyle, padding: 14, color: 'inherit', textDecoration: 'none', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 14, alignItems: 'center' }}
                >
                  <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
                    <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{script.title}</strong>
                    <span style={{ color: '#94a3b8', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tutorial?.title || '未知文档'} · {script.duration} · v{script.version || 1}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <StatusBadge text={relatedProjects.length ? '已有视频' : '待生成'} tone={relatedProjects.length ? 'success' : 'warning'} />
                    <span style={{ color: '#7dd3fc', fontWeight: 800 }}>打开</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyGuide title="还没有脚本" text="先在开始制作页导入文档，系统会自动理解文档并撰写脚本。" href="/" action="开始制作" />
        )}
      </Panel>
    </StudioShell>
  );
}
