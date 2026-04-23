import { TopNav, sharedSurface } from '../_components/top-nav';
import { TrendsClientPanel } from './trends-client-panel';

const shell = sharedSurface;

export default function TrendsPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top, #2e1065 0%, #111827 45%, #020617 100%)', color: '#f8fafc', padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gap: 24 }}>
        <TopNav active="trends" badge="热点映射" />

        <section style={{ ...shell, padding: 24 }}>
          <div style={{ color: '#c4b5fd', letterSpacing: '0.15em', fontSize: 14 }}>TREND MAPPING</div>
          <h1 style={{ fontSize: 42, marginBottom: 8 }}>热点映射</h1>
          <p style={{ color: '#d1d5db', maxWidth: 760, lineHeight: 1.8 }}>
            输入一个热点关键词，系统会在教程资产库中查找最适合重做的教程，并给出推荐切入角度。处理完之后，你可以回首页继续进入教程详情或视频工厂。
          </p>
        </section>

        <TrendsClientPanel />
      </div>
    </main>
  );
}
