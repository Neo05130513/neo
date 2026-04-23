import { TopNav } from '@/app/_components/top-nav';
import { requireRole } from '@/lib/auth';
import { listAuditLogs } from '@/lib/audit';

export default async function AdminAuditPage() {
  await requireRole(['admin']);
  const logs = await listAuditLogs();
  const systemLogs = logs.filter((item) => item.targetType === 'system').slice(0, 200);

  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top left, rgba(56,189,248,0.14) 0%, transparent 24%), radial-gradient(circle at top right, rgba(168,85,247,0.12) 0%, transparent 20%), linear-gradient(180deg, #050816 0%, #0b1120 100%)', color: '#f8fafc', padding: 24 }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: 20 }}>
        <TopNav active="audit" badge="系统审计" />

        <section style={{ borderRadius: 28, border: '1px solid rgba(148,163,184,0.14)', background: 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(6,10,18,0.96) 100%)', padding: 24, display: 'grid', gap: 14 }}>
          <div style={{ color: '#818cf8', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>System Audit</div>
          <h1 style={{ margin: 0, fontSize: 42 }}>系统与账号审计</h1>
          <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.8 }}>这里集中展示系统级审计事件，包括登录成功/失败、账号创建、停用、恢复、密码重置、session 强制下线等管理动作。</p>
        </section>

        <section style={{ borderRadius: 24, border: '1px solid rgba(148,163,184,0.14)', background: 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(6,10,18,0.96) 100%)', padding: 20, display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 28 }}>最近 200 条系统审计</h2>
            <div style={{ color: '#94a3b8' }}>共 {systemLogs.length} 条</div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {systemLogs.length === 0 ? <div style={{ color: '#94a3b8' }}>当前还没有系统级审计记录。</div> : systemLogs.map((log) => (
              <article key={log.id} style={{ borderRadius: 18, padding: 16, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(148,163,184,0.14)', display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <strong>{log.summary}</strong>
                  <span style={{ color: '#94a3b8' }}>{formatDate(log.createdAt)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(30,64,175,0.22)', color: '#bfdbfe', fontSize: 12 }}>{log.actorName}</span>
                  <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(88,28,135,0.22)', color: '#ddd6fe', fontSize: 12 }}>{log.actorRole}</span>
                  <span style={{ padding: '4px 8px', borderRadius: 999, background: 'rgba(120,53,15,0.22)', color: '#fde68a', fontSize: 12 }}>{log.action}</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>target: {log.targetId}</div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}
