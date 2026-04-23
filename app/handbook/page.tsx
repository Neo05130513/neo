export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { sharedSurface } from '../_components/top-nav';
import { newWindowLinkProps } from '../_components/studio-ui';
import { QuickLink } from '../_components/ui';
import { WorkspaceShell } from '../_components/workspace-shell';

const shell = sharedSurface;
const pageBg = 'radial-gradient(circle at top left, rgba(56,189,248,0.14) 0%, transparent 24%), radial-gradient(circle at top right, rgba(244,114,182,0.10) 0%, transparent 20%), linear-gradient(180deg, #050816 0%, #0b1120 100%)';

export default function HandbookPage() {
  return (
    <WorkspaceShell active="handbook" badge="交付操作手册" maxWidth={1240} background={pageBg}>
        <section style={{ ...shell, padding: 26, display: 'grid', gap: 16 }}>
          <div style={{ color: '#818cf8', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Delivery Handbook</div>
          <h1 style={{ margin: 0, fontSize: 'clamp(34px, 5vw, 56px)', lineHeight: 1.02 }}>团队操作手册</h1>
          <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.9, maxWidth: 920 }}>
            这个页面不是产品介绍，而是给团队成员直接上手用的。只需要记住三条线：内容线、视频线、返工线。按这里的顺序走，就能把一篇教程稳定推进成可交付视频。
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <QuickLink href="/" text="回到首页" />
            <QuickLink href="/scripts" text="去脚本工作台" />
            <QuickLink href="/videos" text="去视频工厂" />
            <QuickLink href="/launch-checklist" text="去上线前检查" />
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
          <StepCard step="01" title="内容线" text="导入教程 → 生成选题 → 生成脚本。内容线的目标不是看数量，而是尽快拿到可推进的视频脚本。" tone="#67e8f9" />
          <StepCard step="02" title="视频线" text="从脚本创建视频项目 → 生成分镜 → 渲染素材与成片。视频线的目标是把脚本推进成可检查的样片。" tone="#c4b5fd" />
          <StepCard step="03" title="返工线" text="进入待复核 / 阻塞清单 → 回到返工脚本 → 复制新版本 → 按当前版本重建项目。返工线的目标是稳定修正低质量样片。" tone="#86efac" />
        </section>

        <Panel title="角色快捷入口">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <RoleShortcut title="内容同学" text="先看教程、选题、脚本优先级。" href="/scripts" tone="#67e8f9" />
            <RoleShortcut title="视频同学" text="先看待渲染、失败项目和项目详情。" href="/videos" tone="#c4b5fd" />
            <RoleShortcut title="运营同学" text="先看可发布、待复核、阻塞和返工队列。" href="/videos?view=publishable" tone="#86efac" />
          </div>
        </Panel>

        <Panel title="一、每天先看哪里">
          <OrderedList items={[
            '先看首页：确认失败类型统计、交付队列、系统状态。',
            '再看脚本工作台：优先处理 P0 脚本，保证发布池不断档。',
            '最后看视频工厂：处理可发布、待复核、阻塞三类项目。'
          ]} />
        </Panel>

        <Panel title="二、标准生产流程">
          <OrderedList items={[
            '在教程或首页把未处理内容推进成脚本。',
            '进入脚本工作台，优先从待推进脚本创建视频项目。',
            '进入视频工厂，观察待渲染、渲染中、已完成项目。',
            '执行抽样质检，确认可发布 / 待复核 / 阻塞。',
            '对可发布项目加入待发布队列，对待复核项目做人工复核，对阻塞项目加入返工队列。'
          ]} />
        </Panel>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Panel title="三、如何处理可发布项目">
            <OrderedList items={[
              '进入视频工厂的可发布清单。',
              '优先看已经加入待发布队列的项目。',
              '打开项目详情确认成片、质检记录和输出路径。',
              '确认无误后交给运营同学安排发布。'
            ]} />
          </Panel>

          <Panel title="四、如何处理待复核项目">
            <OrderedList items={[
              '进入待复核清单。',
              '先看问题标签和建议，再决定是否需要返工。',
              '如果只是轻微问题，可标记为已人工复核。',
              '如果问题明显，直接进入返工脚本处理。'
            ]} />
          </Panel>
        </section>

        <Panel title="五、如何做返工">
          <OrderedList items={[
            '在阻塞清单或待复核清单点击“去返工脚本”。',
            '进入脚本详情页，看当前版本和历史版本。',
            '如果要修改文案，先复制为新版本，避免覆盖旧版本。',
            '必要时用版本对比查看 Hook / Body / CTA 的变化。',
            '在脚本详情页直接点“按当前版本重建项目 xxxx”。',
            '重建完成后回到视频工厂继续渲染和复检。'
          ]} />
        </Panel>

        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <Panel title="六、脚本工作台怎么用">
            <OrderedList items={[
              '优先看 P0，P1/P2 用来补充储备。',
              '每条脚本都可以导出 TXT，方便给剪辑或外部协作方。',
              '每条脚本都可以复制为新版本，形成返工链路。',
              '有项目的脚本可以进一步进入详情页看版本家族和对比。'
            ]} />
          </Panel>

          <Panel title="七、视频工厂怎么用">
            <OrderedList items={[
              '默认先看失败项目和待渲染项目。',
              '再按可发布 / 待复核 / 阻塞切换运营视图。',
              '对可发布项目加入待发布队列。',
              '对待复核项目标记人工复核。',
              '对阻塞项目加入返工队列并回到脚本版本处理。'
            ]} />
          </Panel>
        </section>

        <Panel title="八、团队分工建议">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <RoleCard title="内容同学" text="负责教程、选题、脚本质量，优先保证 P0 脚本不断供。" tone="#67e8f9" />
            <RoleCard title="视频同学" text="负责项目创建、分镜、渲染和失败排查，保证出片稳定性。" tone="#c4b5fd" />
            <RoleCard title="运营同学" text="负责可发布队列、人工复核、返工决策和最终发布安排。" tone="#86efac" />
          </div>
        </Panel>

        <Panel title="九、最少记住的原则">
          <OrderedList items={[
            '不要直接改原始脚本，先复制版本。',
            '不要只看 completed，要看是否可发布。',
            '不要只看 failed 数量，要看失败类型。',
            '不要在视频详情页死盯问题，发现阻塞就回到脚本返工。',
            '每轮都要做抽样质检，不要只看渲染成功率。'
          ]} />
        </Panel>
    </WorkspaceShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={{ ...shell, padding: 20, display: 'grid', gap: 14 }}><h2 style={{ margin: 0, fontSize: 24 }}>{title}</h2>{children}</section>;
}

function StepCard({ step, title, text, tone }: { step: string; title: string; text: string; tone: string }) {
  return <div style={{ ...shell, padding: 20, display: 'grid', gap: 10, border: `1px solid ${tone}33` }}><div style={{ color: tone, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{step}</div><strong style={{ fontSize: 22 }}>{title}</strong><div style={{ color: '#dbe4f3', lineHeight: 1.8 }}>{text}</div></div>;
}

function OrderedList({ items }: { items: string[] }) {
  return <ol style={{ margin: 0, paddingLeft: 20, color: '#dbe4f3', lineHeight: 1.9, display: 'grid', gap: 8 }}>{items.map((item) => <li key={item}>{item}</li>)}</ol>;
}

function RoleCard({ title, text, tone }: { title: string; text: string; tone: string }) {
  return <div style={{ borderRadius: 18, padding: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', gap: 8 }}><strong style={{ color: tone }}>{title}</strong><div style={{ color: '#dbe4f3', lineHeight: 1.8 }}>{text}</div></div>;
}

function RoleShortcut({ title, text, href, tone }: { title: string; text: string; href: string; tone: string }) {
  return <Link href={href} {...newWindowLinkProps} style={{ textDecoration: 'none', color: 'inherit' }}><div style={{ borderRadius: 18, padding: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${tone}33`, display: 'grid', gap: 8 }}><strong style={{ color: tone }}>{title}</strong><div style={{ color: '#dbe4f3', lineHeight: 1.8 }}>{text}</div><div style={{ color: tone, fontWeight: 700 }}>直接进入 →</div></div></Link>;
}
