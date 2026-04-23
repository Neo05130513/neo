import Link from 'next/link';
import { sharedSurface } from './top-nav';
import { newWindowLinkProps } from './studio-ui';

export const card = {
  ...sharedSurface,
  boxShadow: '0 24px 80px rgba(0,0,0,0.32)'
} as const;

export function panel() {
  return { borderRadius: 22, border: '1px solid rgba(148,163,184,0.12)', background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))' } as const;
}

export function SectionLabel({ text }: { text: string }) {
  return <div style={{ color: '#818cf8', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{text}</div>;
}

export function Badge({ text, tone, bg }: { text: string; tone: string; bg: string }) {
  return <span style={{ padding: '7px 11px', borderRadius: 999, color: tone, background: bg, fontSize: 12 }}>{text}</span>;
}

export function Signal({ title, value, note, color }: { title: string; value: string; note: string; color: string }) {
  return <div style={{ ...panel(), padding: 16 }}><SectionLabel text={title} /><div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color }}>{value}</div><div style={{ marginTop: 6, color: '#cbd5e1', fontSize: 14 }}>{note}</div></div>;
}

export function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 16, background: 'rgba(255,255,255,0.035)' }}><span style={{ color: '#c0cad8' }}>{label}</span><strong style={{ color: tone }}>{value}</strong></div>;
}

export function WorkflowCard({ step, title, summary, metric, note, href, actionText, tone }: { step: string; title: string; summary: string; metric: string; note: string; href: string; actionText: string; tone: string }) {
  return <div style={{ ...card, padding: 20, display: 'grid', gap: 14 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><div style={{ color: tone, fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800 }}>{step}</div><div style={{ width: 44, height: 4, borderRadius: 999, background: tone, boxShadow: `0 0 18px ${tone}` }} /></div><div><h2 style={{ margin: 0, fontSize: 28 }}>{title}</h2><p style={{ margin: '10px 0 0', color: '#cbd5e1', lineHeight: 1.75 }}>{summary}</p></div><div style={{ fontSize: 30, fontWeight: 800 }}>{metric}</div><div style={{ color: '#94a3b8', lineHeight: 1.7 }}>{note}</div><Link href={href} {...newWindowLinkProps} style={{ color: tone, textDecoration: 'none', fontWeight: 800 }}>{actionText} →</Link></div>;
}

export function BatchCard({ title, desc, actionLabel, accent, action, disabled }: { title: string; desc: string; actionLabel: string; accent: string; action: () => Promise<void>; disabled?: boolean }) {
  return (
    <div style={{ ...panel(), padding: 14, display: 'grid', gap: 10 }}>
      <div style={{ color: accent, fontWeight: 800 }}>{title}</div>
      <div style={{ color: '#cbd5e1', lineHeight: 1.7, minHeight: 48 }}>{desc}</div>
      <form action={action}>
        <button type="submit" disabled={Boolean(disabled)} style={{
          width: '100%',
          border: 'none',
          borderRadius: 12,
          padding: '10px 12px',
          fontWeight: 700,
          color: disabled ? '#9ca3af' : '#061018',
          background: disabled ? 'rgba(148,163,184,0.22)' : accent,
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}>{actionLabel}</button>
      </form>
    </div>
  );
}

export function NavRow({ href, title, desc }: { href: string; title: string; desc: string }) {
  return <Link href={href} {...newWindowLinkProps} style={{ ...panel(), textDecoration: 'none', color: '#eef2ff', padding: 14, display: 'grid', gap: 4, cursor: 'pointer' }}><strong>{title}</strong><span style={{ color: '#b6c2d3', lineHeight: 1.7 }}>{desc}</span></Link>;
}

export function Header({ title, tag, note }: { title: string; tag: string; note?: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}><div><SectionLabel text={tag} /><h2 style={{ margin: '8px 0 0', fontSize: 30 }}>{title}</h2></div>{note ? <span style={{ color: '#8a95aa', fontSize: 14 }}>{note}</span> : null}</div>;
}

export function ActionCallout({ title, desc, href, linkText, tone }: { title: string; desc: string; href: string; linkText: string; tone: string }) {
  return <div style={{ ...panel(), padding: 16, display: 'grid', gap: 10 }}><div style={{ fontSize: 17, fontWeight: 700, color: tone }}>{title}</div><div style={{ color: '#cbd5e1', lineHeight: 1.75 }}>{desc}</div><Link href={href} {...newWindowLinkProps} style={{ color: tone, textDecoration: 'none', fontWeight: 700 }}>{linkText} →</Link></div>;
}

export function HealthTile({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return <div style={{ ...panel(), padding: 14, display: 'grid', gap: 6 }}><div style={{ color: '#9aa6bc', fontSize: 12 }}>{label}</div><div style={{ color: tone, fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{value}</div><div style={{ color: '#cbd5e1', fontSize: 13 }}>{note}</div></div>;
}

export function EmptyState({ text }: { text: string }) {
  return <div style={{ ...panel(), padding: 18, color: '#cbd5e1', lineHeight: 1.8 }}>{text}</div>;
}

export function MiniPill({ text, tone, bg }: { text: string; tone: string; bg: string }) {
  return <span style={{ padding: '6px 10px', borderRadius: 999, color: tone, background: bg, fontSize: 12 }}>{text}</span>;
}

export const primaryButtonStyle = {
  border: 'none',
  borderRadius: 15,
  padding: '13px 18px',
  fontWeight: 800,
  color: '#061018',
  background: 'linear-gradient(135deg, #67e8f9, #22d3ee)',
  cursor: 'pointer'
} as const;

export const secondaryButtonStyle = {
  border: '1px solid rgba(148,163,184,0.18)',
  borderRadius: 15,
  padding: '13px 18px',
  fontWeight: 800,
  color: '#e5ecf7',
  background: 'rgba(255,255,255,0.04)',
  cursor: 'pointer'
} as const;
