import { CSSProperties, ReactNode } from 'react';
import { NavKey, TopNav } from './top-nav';

export const defaultWorkspaceBackground =
  'radial-gradient(circle at top left, rgba(56,189,248,0.14) 0%, transparent 24%), radial-gradient(circle at top right, rgba(168,85,247,0.12) 0%, transparent 20%), linear-gradient(180deg, #050816 0%, #0b1120 100%)';

export async function WorkspaceShell({
  active,
  badge,
  children,
  maxWidth = 1220,
  background = defaultWorkspaceBackground,
  contentStyle
}: {
  active: NavKey;
  badge: string;
  children: ReactNode;
  maxWidth?: number;
  background?: string;
  contentStyle?: CSSProperties;
}) {
  return (
    <main style={{ minHeight: '100vh', background, color: '#f8fafc', padding: 24 }}>
      <div style={{ maxWidth, margin: '0 auto', display: 'grid', gap: 20, ...contentStyle }}>
        <TopNav active={active} badge={badge} />
        {children}
      </div>
    </main>
  );
}
