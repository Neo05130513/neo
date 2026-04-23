import Link from 'next/link';
import { CSSProperties, ReactNode } from 'react';
import { sharedSurface } from './top-nav';
import { newWindowLinkProps } from './studio-ui';

export const surfaceStyle = sharedSurface;

export function Surface({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <section style={{ ...surfaceStyle, ...style }}>{children}</section>;
}

export function MetricRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 16, background: 'rgba(255,255,255,0.035)' }}>
      <span style={{ color: '#c0cad8' }}>{label}</span>
      <strong style={{ color: tone }}>{value}</strong>
    </div>
  );
}

export function QuickLink({ href, text }: { href: string; text: string }) {
  return (
    <Link href={href} {...newWindowLinkProps} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 14, color: '#e5ecf7', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(148,163,184,0.14)' }}>
      {text}
    </Link>
  );
}

export function StagePill({ text, tone, bg }: { text: string; tone: string; bg: string }) {
  return <span style={{ padding: '6px 10px', borderRadius: 999, color: tone, background: bg, fontSize: 12 }}>{text}</span>;
}

export function FilterChip({ href, active, text }: { href: string; active: boolean; text: string }) {
  return (
    <Link href={href} {...newWindowLinkProps} style={{ textDecoration: 'none', padding: '9px 14px', borderRadius: 999, color: active ? '#061018' : '#e5ecf7', background: active ? 'linear-gradient(135deg, #67e8f9, #22d3ee)' : 'rgba(255,255,255,0.04)', border: active ? 'none' : '1px solid rgba(148,163,184,0.14)', fontWeight: 700 }}>
      {text}
    </Link>
  );
}

export function SummaryTile({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return (
    <div style={{ ...surfaceStyle, padding: 18, display: 'grid', gap: 8 }}>
      <div style={{ color: '#94a3b8', fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: tone, fontSize: 24, fontWeight: 800, lineHeight: 1.3 }}>{value}</div>
      <div style={{ color: '#cbd5e1', lineHeight: 1.7 }}>{note}</div>
    </div>
  );
}

export function GuideCard({ title, text, accent }: { title: string; text: string; accent: string }) {
  return (
    <div style={{ ...surfaceStyle, padding: 20, border: `1px solid ${accent}33`, display: 'grid', gap: 8 }}>
      <div style={{ color: accent, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ color: '#e2e8f0', lineHeight: 1.8 }}>{text}</div>
    </div>
  );
}
