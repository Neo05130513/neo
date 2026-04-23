'use client';

import { useState } from 'react';

interface TrendMatchView {
  tutorialId: string;
  tutorialTitle: string;
  score: number;
  reasons: string[];
  suggestedAngles: string[];
}

export function TrendsClientPanel() {
  const [keyword, setKeyword] = useState('AI做PPT');
  const [result, setResult] = useState<TrendMatchView[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/trends/map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword })
      });
      const data = await response.json();
      setResult(data.matches ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12 }}>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="例如：AI做PPT、Cursor、AI办公"
          style={{ flex: 1, padding: '16px 18px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff' }}
        />
        <button type="submit" style={{ padding: '16px 20px', borderRadius: 14, border: 'none', background: '#8b5cf6', color: '#fff', fontWeight: 700 }}>
          {loading ? '匹配中...' : '开始匹配'}
        </button>
      </form>

      <section style={{ display: 'grid', gap: 12 }}>
        {!result ? <p style={{ color: '#cbd5e1' }}>先输入关键词进行匹配。</p> : result.length === 0 ? <p>没有找到匹配教程。</p> : result.map((item) => (
          <article key={item.tutorialId} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 18, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong>{item.tutorialTitle}</strong>
              <span style={{ color: '#c4b5fd' }}>匹配度 {item.score}</span>
            </div>
            <div style={{ marginTop: 10, color: '#d1d5db', lineHeight: 1.8 }}>{item.reasons.join(' ｜ ')}</div>
            <div style={{ marginTop: 10, color: '#93c5fd' }}>建议切入：{item.suggestedAngles.join('、')}</div>
          </article>
        ))}
      </section>
    </>
  );
}

