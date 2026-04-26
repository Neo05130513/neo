import Link from 'next/link';

export const newWindowLinkProps = {} as const;

export const panelStyle = {
  borderRadius: 20,
  border: '1px solid #263244',
  background: '#151b26'
} as const;

export const subtlePanelStyle = {
  borderRadius: 18,
  border: '1px solid #243042',
  background: '#111823'
} as const;

export const primaryButtonStyle = {
  border: '1px solid #38bdf8',
  borderRadius: 14,
  background: '#38bdf8',
  color: '#061018',
  padding: '11px 14px',
  fontWeight: 800,
  cursor: 'pointer'
} as const;

export const secondaryButtonStyle = {
  border: '1px solid #334155',
  borderRadius: 14,
  background: '#1b2330',
  color: '#e2e8f0',
  padding: '10px 13px',
  fontWeight: 700,
  cursor: 'pointer'
} as const;

export function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <section style={{ ...panelStyle, padding: 20, ...style }}>{children}</section>;
}

export function SectionTitle({ eyebrow, title, note }: { eyebrow?: string; title: string; note?: string }) {
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      {eyebrow ? <div style={{ color: '#38bdf8', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{eyebrow}</div> : null}
      <h2 style={{ margin: 0, fontSize: 22, letterSpacing: 0 }}>{title}</h2>
      {note ? <p style={{ margin: 0, color: '#94a3b8', lineHeight: 1.7 }}>{note}</p> : null}
    </div>
  );
}

export function StatusBadge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }) {
  const colors = {
    neutral: { color: '#cbd5e1', bg: '#1e293b', border: '#334155' },
    info: { color: '#7dd3fc', bg: '#082f49', border: '#155e75' },
    success: { color: '#86efac', bg: '#052e1a', border: '#166534' },
    warning: { color: '#fde68a', bg: '#3b2a08', border: '#854d0e' },
    danger: { color: '#fecaca', bg: '#3b1116', border: '#7f1d1d' }
  }[tone];

  return <span style={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', borderRadius: 999, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.color, padding: '5px 9px', fontSize: 12, fontWeight: 700 }}>{text}</span>;
}

export function MetricTile({ label, value, note, tone = '#38bdf8' }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div style={{ ...subtlePanelStyle, padding: 14, display: 'grid', gap: 6 }}>
      <span style={{ color: '#8ea0b8', fontSize: 12 }}>{label}</span>
      <strong style={{ color: tone, fontSize: 24, lineHeight: 1.15 }}>{value}</strong>
      {note ? <span style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>{note}</span> : null}
    </div>
  );
}

export function EmptyGuide({ title, text, href, action }: { title: string; text: string; href?: string; action?: string }) {
  return (
    <div style={{ ...subtlePanelStyle, padding: 18, display: 'grid', gap: 8 }}>
      <strong>{title}</strong>
      <span style={{ color: '#94a3b8', lineHeight: 1.7 }}>{text}</span>
      {href && action ? <Link href={href} {...newWindowLinkProps} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 800 }}>{action}</Link> : null}
    </div>
  );
}

export function linkButtonStyle(kind: 'primary' | 'secondary' = 'secondary') {
  return {
    ...(kind === 'primary' ? primaryButtonStyle : secondaryButtonStyle),
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none'
  } as const;
}
