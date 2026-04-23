import { TopNav } from '../_components/top-nav';
import { requireRole, getSessions } from '@/lib/auth';
import { listUsers } from '@/lib/users';
import { UserAdminPanel } from './user-admin-panel';

export default async function UsersPage() {
  await requireRole(['admin']);
  const [users, sessions] = await Promise.all([listUsers(), getSessions()]);

  return (
    <main style={{ minHeight: '100vh', background: 'radial-gradient(circle at top left, rgba(56,189,248,0.14) 0%, transparent 24%), radial-gradient(circle at top right, rgba(168,85,247,0.12) 0%, transparent 20%), linear-gradient(180deg, #050816 0%, #0b1120 100%)', color: '#f8fafc', padding: 24 }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gap: 20 }}>
        <TopNav active="users" badge="账号管理" />

        <section style={{ borderRadius: 28, border: '1px solid rgba(148,163,184,0.14)', background: 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(6,10,18,0.96) 100%)', padding: 24, display: 'grid', gap: 14 }}>
          <div style={{ color: '#818cf8', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Admin Console</div>
          <h1 style={{ margin: 0, fontSize: 42 }}>团队账号管理</h1>
          <p style={{ margin: 0, color: '#cbd5e1', lineHeight: 1.8 }}>这里用于新增成员、调整角色、重置临时密码、停用/恢复账号，并查看当前在线 session。当前页面仅管理员可见，所有关键管理动作都会进入操作审计。</p>
        </section>

        <UserAdminPanel initialUsers={users} initialSessions={sessions} />
      </div>
    </main>
  );
}
