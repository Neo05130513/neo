import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from 'remotion';
import type { RemotionSceneInput, RemotionVideoInput } from './types';

const FPS = 30;

type AiPalette = {
  bg: string;
  surface: string;
  surfaceStrong: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  positive: string;
  alert: string;
};

type AiLayout = {
  isWide: boolean;
};

const palettes: Record<string, AiPalette> = {
  'clarity-blue': {
    bg: '#06121e',
    surface: 'rgba(13, 35, 54, 0.76)',
    surfaceStrong: 'rgba(4, 13, 24, 0.9)',
    line: 'rgba(125, 211, 252, 0.28)',
    text: '#f8fafc',
    muted: '#bad0e5',
    accent: '#22d3ee',
    accent2: '#a78bfa',
    positive: '#34d399',
    alert: '#fbbf24'
  },
  'midnight-cyan': {
    bg: '#03151b',
    surface: 'rgba(7, 47, 57, 0.76)',
    surfaceStrong: 'rgba(3, 20, 26, 0.92)',
    line: 'rgba(45, 212, 191, 0.26)',
    text: '#f0fdfa',
    muted: '#a6cbd1',
    accent: '#2dd4bf',
    accent2: '#60a5fa',
    positive: '#86efac',
    alert: '#fde047'
  },
  'sunset-amber': {
    bg: '#1b0d12',
    surface: 'rgba(58, 26, 31, 0.76)',
    surfaceStrong: 'rgba(28, 12, 16, 0.92)',
    line: 'rgba(251, 146, 60, 0.28)',
    text: '#fff7ed',
    muted: '#f4c7ad',
    accent: '#fb923c',
    accent2: '#f472b6',
    positive: '#a7f3d0',
    alert: '#fde68a'
  }
};

const shotMeta: Record<RemotionSceneInput['shotType'], { label: string; eyebrow: string; mark: string }> = {
  title: { label: 'AI EXPLAINER', eyebrow: '核心观点', mark: '01' },
  pain: { label: 'THE GAP', eyebrow: '问题在哪', mark: '02' },
  step: { label: 'HOW IT WORKS', eyebrow: '拆成步骤', mark: '03' },
  result: { label: 'RESULT', eyebrow: '能带来什么', mark: '04' },
  cta: { label: 'NEXT ACTION', eyebrow: '下一步', mark: '05' }
};

function sceneFrames(scene: RemotionSceneInput) {
  return Math.max(1, Math.round(scene.durationSec * FPS));
}

function getSceneStart(scenes: RemotionSceneInput[], index: number) {
  return scenes.slice(0, index).reduce((total, scene) => total + sceneFrames(scene), 0);
}

export function getAiExplainerDurationInFrames(input: RemotionVideoInput) {
  return Math.max(FPS * 5, input.scenes.reduce((total, scene) => total + sceneFrames(scene), 0));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function localProgress(frame: number, duration: number) {
  return clamp(frame / Math.max(1, duration), 0, 1);
}

function compactText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function splitLines(text: string, maxChars: number, maxLines: number) {
  const compact = compactText(text);
  if (!compact) return [''];
  const lines = compact.match(new RegExp(`.{1,${maxChars}}`, 'g')) || [compact];
  if (lines.length > 1 && /^[，。！？、；：,.!?;:]$/.test(lines[lines.length - 1])) {
    lines[lines.length - 2] = `${lines[lines.length - 2]}${lines[lines.length - 1]}`;
    lines.pop();
  }
  return lines.slice(0, maxLines);
}

function keyTerms(scene: RemotionSceneInput) {
  const terms = [
    ...(scene.keywords || []),
    ...(scene.emphasis ? [scene.emphasis] : []),
    ...compactText(scene.subtitle).split(/[，、。！？\s]+/)
  ]
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 12);

  return Array.from(new Set(terms)).slice(0, 5);
}

function cardItems(scene: RemotionSceneInput) {
  if (scene.cards?.length) return scene.cards.slice(0, 4);
  const source = compactText(scene.voiceover || scene.subtitle);
  const parts = source
    .split(/[。！？；;,.，、]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
  return (parts.length ? parts : splitLines(source, 12, 4)).slice(0, 4);
}

function chartValues(scene: RemotionSceneInput, count: number) {
  const values = scene.chartData?.length ? scene.chartData : [32, 54, 48, 76, 88];
  const normalized = values.slice(0, count).map((value) => clamp(Number(value) || 0, 8, 100));
  while (normalized.length < count) normalized.push(normalized[normalized.length - 1] || 42);
  return normalized;
}

function primaryDisplay(scene: RemotionSceneInput) {
  if (scene.layout === 'hero') return 'hero';
  if (scene.layout === 'chart') return 'data';
  if (scene.layout === 'process') return 'process';
  if (scene.layout === 'timeline') return 'timeline';
  if (scene.layout === 'matrix') return 'matrix';
  if (scene.layout === 'network') return 'network';
  if (scene.layout === 'pyramid') return 'pyramid';
  if (scene.layout === 'contrast' || scene.layout === 'cause' || scene.layout === 'mistake') return 'contrast';
  if (scene.layout === 'cta') return 'cta';
  if (scene.layout === 'checklist') return 'checklist';
  if (scene.shotType === 'title') return 'hero';
  if (scene.visualType === 'image') return 'data';
  if (scene.shotType === 'step') return 'process';
  return 'cards';
}

function Background({ palette, progress }: { palette: AiPalette; progress: number }) {
  const drift = interpolate(progress, [0, 1], [-36, 42], { easing: Easing.inOut(Easing.cubic) });
  const sweep = interpolate(progress, [0, 1], [-220, 260]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(145deg, ${palette.bg} 0%, #020617 58%, #111827 100%)`,
        overflow: 'hidden'
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${staticFile('noise.svg')})`,
          opacity: 0.06
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.13,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)',
          backgroundSize: '76px 76px',
          transform: `translateY(${drift}px)`
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            `linear-gradient(116deg, transparent 0%, transparent 35%, ${palette.accent}18 48%, transparent 62%, transparent 100%)`,
          transform: `translateX(${sweep}px)`
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 10,
          background: `linear-gradient(90deg, ${palette.accent}, ${palette.accent2}, ${palette.positive})`
        }}
      />
    </AbsoluteFill>
  );
}

function Header({
  input,
  scene,
  sceneIndex,
  sceneCount,
  palette,
  enter,
  layout
}: {
  input: RemotionVideoInput;
  scene: RemotionSceneInput;
  sceneIndex: number;
  sceneCount: number;
  palette: AiPalette;
  enter: number;
  layout: AiLayout;
}) {
  const meta = shotMeta[scene.shotType];
  const isWide = layout.isWide;
  return (
    <div
      style={{
        position: 'absolute',
        left: isWide ? 64 : 58,
        right: isWide ? 64 : 58,
        top: isWide ? 42 : 58,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [22, 0])}px)`
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div
          style={{
            width: 72,
            height: 72,
            display: 'grid',
            placeItems: 'center',
            border: `1px solid ${palette.line}`,
            background: palette.surface,
            color: palette.accent,
            fontSize: 26,
            fontWeight: 950
          }}
        >
          {meta.mark}
        </div>
        <div>
          <div style={{ color: palette.accent, fontSize: 24, fontWeight: 950 }}>{meta.label}</div>
          <div style={{ color: palette.muted, fontSize: 20, marginTop: 5 }}>{meta.eyebrow}</div>
        </div>
      </div>
      <div style={{ width: isWide ? 520 : 260, textAlign: 'right' }}>
        <div style={{ color: palette.text, fontSize: isWide ? 26 : 24, fontWeight: 900, lineHeight: 1.2 }}>
          {splitLines(input.project.title, isWide ? 22 : 11, isWide ? 2 : 2).map((line, index) => (
            <div key={`${line}-${index}`}>{line}</div>
          ))}
        </div>
        <div style={{ height: 6, marginTop: 12, background: 'rgba(255,255,255,0.13)', overflow: 'hidden' }}>
          <div style={{ width: `${((sceneIndex + 1) / sceneCount) * 100}%`, height: '100%', background: palette.accent }} />
        </div>
      </div>
    </div>
  );
}

function HeroPanel({ scene, palette, enter, layout }: { scene: RemotionSceneInput; palette: AiPalette; enter: number; layout: AiLayout }) {
  const isWide = layout.isWide;
  const title = splitLines(scene.headline || scene.subtitle, isWide ? 16 : 12, isWide ? 2 : 3);
  const emphasis = scene.emphasis || keyTerms(scene)[0] || 'AI';
  return (
    <div
      style={{
        position: 'absolute',
        left: isWide ? 88 : 72,
        right: isWide ? 720 : 72,
        top: isWide ? 184 : 210,
        display: 'grid',
        gap: isWide ? 22 : 30,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [42, 0])}px)`
      }}
    >
      <div
        style={{
          color: palette.text,
          fontSize: isWide ? 70 : 84,
          lineHeight: 1.06,
          fontWeight: 980,
          textWrap: 'balance'
        }}
      >
        {title.map((line, index) => (
          <div key={`${line}-${index}`}>{line}</div>
        ))}
      </div>
      <div
        style={{
          width: 'fit-content',
          maxWidth: '100%',
          padding: isWide ? '14px 22px' : '18px 26px',
          color: '#020617',
          background: `linear-gradient(90deg, ${palette.accent}, ${palette.positive})`,
          fontSize: isWide ? 26 : 30,
          fontWeight: 950
        }}
      >
        {emphasis}
      </div>
      <div style={{ color: palette.muted, fontSize: isWide ? 27 : 30, lineHeight: 1.48, maxWidth: isWide ? 720 : 840 }}>
        {splitLines(scene.voiceover, isWide ? 30 : 22, isWide ? 3 : 3).map((line, index) => (
          <div key={`${line}-${index}`}>{line}</div>
        ))}
      </div>
      {isWide ? (
        <div
          style={{
            position: 'absolute',
            left: 1260,
            top: 188,
            width: 500,
            height: 520,
            border: `1px solid ${palette.line}`,
            background: palette.surfaceStrong,
            display: 'grid',
            alignContent: 'center',
            gap: 20,
            padding: 38
          }}
        >
          <div style={{ color: palette.accent, fontSize: 26, fontWeight: 950 }}>TEMPLATE PREVIEW</div>
          {keyTerms(scene).slice(0, 4).map((term, index) => (
            <div key={`${term}-${index}`} style={{ color: palette.text, fontSize: 36, fontWeight: 900, lineHeight: 1.16 }}>
              {String(index + 1).padStart(2, '0')} / {term}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InsightCards({ scene, palette, enter, layout }: { scene: RemotionSceneInput; palette: AiPalette; enter: number; layout: AiLayout }) {
  const items = cardItems(scene);
  const isWide = layout.isWide;
  return (
    <div
      style={{
        position: 'absolute',
        left: isWide ? 88 : 70,
        right: isWide ? 88 : 70,
        top: isWide ? 190 : 260,
        display: 'grid',
        gridTemplateColumns: isWide ? `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` : items.length > 2 ? '1fr 1fr' : '1fr',
        gap: isWide ? 20 : 18,
        opacity: enter
      }}
    >
      {items.map((item, index) => (
        <div
          key={`${item}-${index}`}
          style={{
            minHeight: isWide ? 410 : 154,
            padding: isWide ? 28 : 24,
            border: `1px solid ${palette.line}`,
            background: index === 0 ? palette.surfaceStrong : palette.surface,
            transform: `translateY(${interpolate(enter, [0, 1], [30 + index * 10, 0])}px)`
          }}
        >
          <div style={{ color: index === 0 ? palette.accent : palette.accent2, fontSize: 24, fontWeight: 950 }}>
            {String(index + 1).padStart(2, '0')}
          </div>
          <div style={{ color: palette.text, fontSize: isWide ? 32 : 34, lineHeight: 1.28, fontWeight: 880, marginTop: 12 }}>
            {splitLines(item, isWide ? 10 : 15, isWide ? 5 : 3).map((line, lineIndex) => (
              <div key={`${line}-${lineIndex}`}>{line}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProcessStrip({ scene, palette, enter, layout }: { scene: RemotionSceneInput; palette: AiPalette; enter: number; layout: AiLayout }) {
  const items = cardItems(scene).slice(0, 3);
  const isWide = layout.isWide;
  return (
    <div
      style={{
        position: 'absolute',
        left: isWide ? 88 : 70,
        right: isWide ? 88 : 70,
        top: isWide ? 220 : 300,
        display: 'grid',
        gridTemplateColumns: isWide ? 'repeat(3, minmax(0, 1fr))' : '1fr',
        gap: isWide ? 20 : 22,
        opacity: enter
      }}
    >
      {items.map((item, index) => (
        <div key={`${item}-${index}`} style={{ display: 'grid', gridTemplateColumns: isWide ? '1fr' : '92px 1fr', gridTemplateRows: isWide ? '92px 1fr' : undefined, alignItems: 'stretch', gap: 16 }}>
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              background: index === 1 ? palette.accent : palette.surface,
              color: index === 1 ? '#020617' : palette.accent,
              border: `1px solid ${palette.line}`,
              fontSize: 32,
              fontWeight: 950
            }}
          >
            {index + 1}
          </div>
          <div
            style={{
              padding: '26px 28px',
              minHeight: isWide ? 300 : undefined,
              background: palette.surface,
              border: `1px solid ${palette.line}`,
              color: palette.text,
              fontSize: isWide ? 34 : 36,
              lineHeight: 1.25,
              fontWeight: 880,
              transform: `translateX(${interpolate(enter, [0, 1], [42, 0])}px)`
            }}
          >
            {splitLines(item, isWide ? 12 : 18, isWide ? 4 : 2).map((line, lineIndex) => (
              <div key={`${line}-${lineIndex}`}>{line}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DataPanel({ scene, palette, enter, progress, layout }: { scene: RemotionSceneInput; palette: AiPalette; enter: number; progress: number; layout: AiLayout }) {
  const values = chartValues(scene, 5);
  const isWide = layout.isWide;
  return (
    <div
      style={{
        position: 'absolute',
        left: isWide ? 110 : 70,
        right: isWide ? 110 : 70,
        top: isWide ? 176 : 280,
        padding: isWide ? 34 : 30,
        border: `1px solid ${palette.line}`,
        background: palette.surfaceStrong,
        opacity: enter
      }}
    >
      <div style={{ color: palette.muted, fontSize: 24, fontWeight: 850 }}>Signal change</div>
      <div style={{ display: 'flex', height: isWide ? 470 : 360, gap: 22, alignItems: 'end', marginTop: 34 }}>
        {values.map((value, index) => (
          <div key={`${value}-${index}`} style={{ flex: 1, display: 'grid', gap: 12 }}>
            <div
              style={{
                height: `${interpolate(progress, [0, 1], [12, value])}%`,
                background: `linear-gradient(180deg, ${palette.accent}, ${index % 2 ? palette.accent2 : palette.positive})`,
                border: `1px solid ${palette.line}`
              }}
            />
            <div style={{ color: palette.muted, fontSize: 20, textAlign: 'center' }}>{index + 1}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContrastPanel({ scene, palette, enter, layout }: { scene: RemotionSceneInput; palette: AiPalette; enter: number; layout: AiLayout }) {
  const items = cardItems(scene).slice(0, 2);
  const isWide = layout.isWide;
  const modeLabel = scene.layout === 'mistake' ? '常见误区' : scene.layout === 'cause' ? '原因拆解' : '前后对比';
  return (
    <div
      style={{
        position: 'absolute',
        left: isWide ? 88 : 70,
        right: isWide ? 88 : 70,
        top: isWide ? 198 : 260,
        display: 'grid',
        gridTemplateColumns: isWide ? '1.15fr 0.85fr' : '1fr',
        gap: 20,
        opacity: enter
      }}
    >
      <div
        style={{
          minHeight: isWide ? 418 : 240,
          padding: isWide ? 34 : 28,
          border: `1px solid ${palette.line}`,
          background: palette.surfaceStrong
        }}
      >
        <div style={{ color: palette.alert, fontSize: 22, fontWeight: 900 }}>{modeLabel}</div>
        <div style={{ color: palette.text, fontSize: isWide ? 56 : 48, lineHeight: 1.08, fontWeight: 950, marginTop: 18 }}>
          {splitLines(scene.headline || items[0] || scene.subtitle, isWide ? 12 : 14, 3).map((line, index) => (
            <div key={`${line}-${index}`}>{line}</div>
          ))}
        </div>
        <div style={{ color: palette.muted, fontSize: isWide ? 26 : 28, lineHeight: 1.42, marginTop: 22 }}>
          {splitLines(scene.voiceover, isWide ? 28 : 20, 4).map((line, index) => (
            <div key={`${line}-${index}`}>{line}</div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gap: 16 }}>
        {items.map((item, index) => (
          <div
            key={`${item}-${index}`}
            style={{
              minHeight: isWide ? 200 : 150,
              padding: '24px 26px',
              border: `1px solid ${palette.line}`,
              background: index === 0 ? `${palette.alert}18` : `${palette.accent}14`,
              color: palette.text,
              transform: `translateX(${interpolate(enter, [0, 1], [28 + index * 12, 0])}px)`
            }}
          >
            <div style={{ color: index === 0 ? palette.alert : palette.accent, fontSize: 20, fontWeight: 900 }}>
              {index === 0 ? '问题点' : '解决线索'}
            </div>
            <div style={{ fontSize: isWide ? 30 : 32, lineHeight: 1.28, fontWeight: 860, marginTop: 12 }}>
              {splitLines(item, isWide ? 10 : 14, 4).map((line, lineIndex) => (
                <div key={`${line}-${lineIndex}`}>{line}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelinePanel({ scene, palette, enter, layout }: { scene: RemotionSceneInput; palette: AiPalette; enter: number; layout: AiLayout }) {
  const items = cardItems(scene).slice(0, 4);
  const isWide = layout.isWide;
  return (
    <div
      style={{
        position: 'absolute',
        left: isWide ? 92 : 70,
        right: isWide ? 92 : 70,
        top: isWide ? 232 : 276,
        display: 'grid',
        gridTemplateColumns: isWide ? `repeat(${items.length}, minmax(0, 1fr))` : '1fr',
        gap: 18,
        opacity: enter
      }}
    >
      {items.map((item, index) => (
        <div key={`${item}-${index}`} style={{ position: 'relative', paddingTop: isWide ? 40 : 0, paddingLeft: isWide ? 0 : 70 }}>
          <div
            style={{
              position: 'absolute',
              left: isWide ? 0 : 20,
              top: isWide ? 10 : 0,
              width: isWide ? '100%' : 2,
              height: isWide ? 2 : '100%',
              background: `linear-gradient(90deg, ${palette.accent}, ${palette.accent2})`,
              opacity: 0.65
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: isWide ? 0 : 0,
              top: isWide ? 0 : 0,
              width: 40,
              height: 40,
              borderRadius: 999,
              background: palette.accent,
              color: '#020617',
              display: 'grid',
              placeItems: 'center',
              fontSize: 20,
              fontWeight: 950
            }}
          >
            {index + 1}
          </div>
          <div
            style={{
              marginTop: isWide ? 24 : 0,
              minHeight: isWide ? 260 : 120,
              padding: '22px 24px',
              border: `1px solid ${palette.line}`,
              background: palette.surface
            }}
          >
            <div style={{ color: palette.text, fontSize: isWide ? 28 : 30, lineHeight: 1.28, fontWeight: 860 }}>
              {splitLines(item, isWide ? 9 : 16, isWide ? 4 : 3).map((line, lineIndex) => (
                <div key={`${line}-${lineIndex}`}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MatrixPanel({ scene, palette, enter, layout }: { scene: RemotionSceneInput; palette: AiPalette; enter: number; layout: AiLayout }) {
  const items = cardItems(scene).slice(0, 4);
  const labels = ['认知', '动作', '效果', '复用'];
  const isWide = layout.isWide;
  return (
    <div
      style={{
        position: 'absolute',
        left: isWide ? 124 : 70,
        right: isWide ? 124 : 70,
        top: isWide ? 210 : 280,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 18,
        opacity: enter
      }}
    >
      {items.map((item, index) => (
        <div
          key={`${item}-${index}`}
          style={{
            minHeight: isWide ? 190 : 160,
            padding: '22px 24px',
            border: `1px solid ${palette.line}`,
            background: index === 0 ? palette.surfaceStrong : palette.surface
          }}
        >
          <div style={{ color: index % 2 === 0 ? palette.accent : palette.accent2, fontSize: 20, fontWeight: 900 }}>
            {labels[index] || `模块 ${index + 1}`}
          </div>
          <div style={{ color: palette.text, fontSize: isWide ? 28 : 30, lineHeight: 1.28, fontWeight: 860, marginTop: 14 }}>
            {splitLines(item, isWide ? 11 : 14, 4).map((line, lineIndex) => (
              <div key={`${line}-${lineIndex}`}>{line}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function NetworkPanel({ scene, palette, enter, progress, layout }: { scene: RemotionSceneInput; palette: AiPalette; enter: number; progress: number; layout: AiLayout }) {
  const items = cardItems(scene).slice(0, 4);
  const isWide = layout.isWide;
  const nodes = isWide
    ? [
        { left: 240, top: 320 },
        { left: 700, top: 170 },
        { left: 1180, top: 320 },
        { left: 700, top: 490 }
      ]
    : [
        { left: 120, top: 280 },
        { left: 420, top: 180 },
        { left: 420, top: 430 },
        { left: 120, top: 560 }
      ];
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: enter }}>
      {nodes.slice(0, items.length).map((node, index) => (
        <div
          key={`line-${index}`}
          style={{
            position: 'absolute',
            left: isWide ? 760 : 240,
            top: isWide ? 392 : 420,
            width: isWide ? Math.abs(node.left - 760) : Math.abs(node.left - 240),
            height: 2,
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.accent2})`,
            transformOrigin: 'left center',
            transform: `rotate(${Math.atan2(node.top - (isWide ? 392 : 420), node.left - (isWide ? 760 : 240))}rad) scaleX(${0.7 + progress * 0.3})`,
            opacity: 0.55
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: isWide ? 650 : 140,
          top: isWide ? 290 : 360,
          width: isWide ? 220 : 200,
          minHeight: 180,
          padding: '22px 24px',
          border: `1px solid ${palette.line}`,
          background: palette.surfaceStrong
        }}
      >
        <div style={{ color: palette.accent, fontSize: 20, fontWeight: 900 }}>核心节点</div>
        <div style={{ color: palette.text, fontSize: isWide ? 34 : 32, lineHeight: 1.2, fontWeight: 920, marginTop: 12 }}>
          {splitLines(scene.headline || scene.emphasis || '核心逻辑', 8, 3).map((line, index) => (
            <div key={`${line}-${index}`}>{line}</div>
          ))}
        </div>
      </div>
      {items.slice(0, nodes.length).map((item, index) => (
        <div
          key={`${item}-${index}`}
          style={{
            position: 'absolute',
            left: nodes[index]?.left,
            top: nodes[index]?.top,
            width: isWide ? 280 : 220,
            minHeight: isWide ? 130 : 110,
            padding: '20px 22px',
            border: `1px solid ${palette.line}`,
            background: index % 2 === 0 ? palette.surface : `${palette.accent}12`,
            color: palette.text,
            transform: `translateY(${interpolate(enter, [0, 1], [22 + index * 8, 0])}px)`
          }}
        >
          <div style={{ fontSize: isWide ? 26 : 24, lineHeight: 1.3, fontWeight: 860 }}>
            {splitLines(item, isWide ? 9 : 10, 4).map((line, lineIndex) => (
              <div key={`${line}-${lineIndex}`}>{line}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PyramidPanel({ scene, palette, enter, layout }: { scene: RemotionSceneInput; palette: AiPalette; enter: number; layout: AiLayout }) {
  const items = cardItems(scene).slice(0, 4).reverse();
  const isWide = layout.isWide;
  const widths = isWide ? [900, 700, 500, 320] : [520, 420, 320, 230];
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: isWide ? 210 : 290,
        display: 'grid',
        justifyItems: 'center',
        gap: 14,
        opacity: enter
      }}
    >
      {items.map((item, index) => (
        <div
          key={`${item}-${index}`}
          style={{
            width: widths[index] || widths[widths.length - 1],
            minHeight: isWide ? 88 : 80,
            padding: '18px 24px',
            border: `1px solid ${palette.line}`,
            background: index === 0 ? `${palette.accent2}20` : index === items.length - 1 ? palette.surfaceStrong : palette.surface,
            color: palette.text,
            textAlign: 'center',
            transform: `translateY(${interpolate(enter, [0, 1], [32 - index * 4, 0])}px)`
          }}
        >
          <div style={{ fontSize: isWide ? 28 : 30, lineHeight: 1.24, fontWeight: 880 }}>
            {splitLines(item, isWide ? 18 : 16, 2).map((line, lineIndex) => (
              <div key={`${line}-${lineIndex}`}>{line}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChecklistPanel({ scene, palette, enter, layout }: { scene: RemotionSceneInput; palette: AiPalette; enter: number; layout: AiLayout }) {
  const items = cardItems(scene).slice(0, 4);
  const isWide = layout.isWide;
  return (
    <div
      style={{
        position: 'absolute',
        left: isWide ? 180 : 70,
        right: isWide ? 180 : 70,
        top: isWide ? 216 : 276,
        display: 'grid',
        gap: 16,
        opacity: enter
      }}
    >
      {items.map((item, index) => (
        <div
          key={`${item}-${index}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '72px 1fr',
            alignItems: 'center',
            gap: 18,
            minHeight: isWide ? 94 : 88,
            padding: '0 24px 0 0',
            border: `1px solid ${palette.line}`,
            background: index === 0 ? palette.surfaceStrong : palette.surface
          }}
        >
          <div
            style={{
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              background: `linear-gradient(180deg, ${palette.accent}, ${palette.positive})`,
              color: '#020617',
              fontSize: 26,
              fontWeight: 950
            }}
          >
            ✓
          </div>
          <div style={{ color: palette.text, fontSize: isWide ? 29 : 30, lineHeight: 1.26, fontWeight: 860 }}>
            {splitLines(item, isWide ? 22 : 14, 2).map((line, lineIndex) => (
              <div key={`${line}-${lineIndex}`}>{line}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CtaPanel({ scene, palette, enter, layout }: { scene: RemotionSceneInput; palette: AiPalette; enter: number; layout: AiLayout }) {
  const isWide = layout.isWide;
  return (
    <div
      style={{
        position: 'absolute',
        left: isWide ? 112 : 72,
        right: isWide ? 112 : 72,
        top: isWide ? 208 : 286,
        padding: isWide ? '38px 42px' : '34px 30px',
        border: `1px solid ${palette.line}`,
        background: palette.surfaceStrong,
        display: 'grid',
        gap: 24,
        opacity: enter
      }}
    >
      <div style={{ color: palette.accent, fontSize: 22, fontWeight: 900 }}>下一步动作</div>
      <div style={{ color: palette.text, fontSize: isWide ? 64 : 52, lineHeight: 1.08, fontWeight: 960 }}>
        {splitLines(scene.headline || scene.subtitle, isWide ? 16 : 12, 3).map((line, index) => (
          <div key={`${line}-${index}`}>{line}</div>
        ))}
      </div>
      <div style={{ color: palette.muted, fontSize: isWide ? 28 : 30, lineHeight: 1.42 }}>
        {splitLines(scene.voiceover, isWide ? 34 : 20, 3).map((line, index) => (
          <div key={`${line}-${index}`}>{line}</div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {keyTerms(scene).slice(0, 3).map((term, index) => (
          <div
            key={`${term}-${index}`}
            style={{
              padding: '14px 22px',
              background: index === 0 ? `linear-gradient(90deg, ${palette.accent}, ${palette.positive})` : 'rgba(255,255,255,0.08)',
              color: index === 0 ? '#020617' : palette.text,
              border: `1px solid ${index === 0 ? palette.accent : palette.line}`,
              fontSize: 22,
              fontWeight: 900
            }}
          >
            {term}
          </div>
        ))}
      </div>
    </div>
  );
}

function Keywords({ scene, palette, enter, layout }: { scene: RemotionSceneInput; palette: AiPalette; enter: number; layout: AiLayout }) {
  const terms = keyTerms(scene);
  const isWide = layout.isWide;
  if (!terms.length) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: isWide ? 88 : 70,
        right: isWide ? 88 : 70,
        bottom: isWide ? 144 : 226,
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        opacity: enter
      }}
    >
      {terms.map((term, index) => (
        <div
          key={`${term}-${index}`}
          style={{
            padding: '11px 18px',
            background: index === 0 ? `${palette.accent}2e` : 'rgba(255,255,255,0.07)',
            border: `1px solid ${index === 0 ? palette.accent : palette.line}`,
            color: index === 0 ? palette.accent : palette.text,
            fontSize: isWide ? 20 : 22,
            fontWeight: 850
          }}
        >
          {term}
        </div>
      ))}
    </div>
  );
}

function SubtitleBar({ scene, palette, frame, layout }: { scene: RemotionSceneInput; palette: AiPalette; frame: number; layout: AiLayout }) {
  const activeCue = scene.subtitleCues?.find((cue) => frame >= cue.startSec * FPS && frame <= cue.endSec * FPS);
  const text = activeCue?.text || scene.subtitle;
  const isWide = layout.isWide;
  return (
    <div
      style={{
        position: 'absolute',
        left: isWide ? 260 : 62,
        right: isWide ? 260 : 62,
        bottom: isWide ? 38 : 62,
        padding: isWide ? '16px 24px' : '20px 24px',
        background: 'rgba(2, 6, 23, 0.82)',
        border: `1px solid ${palette.line}`,
        color: palette.text,
        fontSize: isWide ? 28 : 34,
        lineHeight: 1.28,
        fontWeight: 850,
        textAlign: 'center'
      }}
    >
      {splitLines(text, isWide ? 34 : 24, 2).map((line, index) => (
        <div key={`${line}-${index}`}>{line}</div>
      ))}
    </div>
  );
}

function SceneVisual({
  input,
  scene,
  sceneIndex,
  sceneCount,
  palette
}: {
  input: RemotionVideoInput;
  scene: RemotionSceneInput;
  sceneIndex: number;
  sceneCount: number;
  palette: AiPalette;
}) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const layout = { isWide: width > height };
  const duration = sceneFrames(scene);
  const progress = localProgress(frame, duration);
  const enter = Math.max(0.72, spring({ frame, fps, config: { damping: 18, stiffness: 90, mass: 0.9 } }));
  const displayMode = primaryDisplay(scene);

  return (
    <AbsoluteFill>
      <Background palette={palette} progress={progress} />
      <Header input={input} scene={scene} sceneIndex={sceneIndex} sceneCount={sceneCount} palette={palette} enter={enter} layout={layout} />
      {displayMode === 'hero' ? <HeroPanel scene={scene} palette={palette} enter={enter} layout={layout} /> : null}
      {displayMode === 'cards' ? <InsightCards scene={scene} palette={palette} enter={enter} layout={layout} /> : null}
      {displayMode === 'process' ? <ProcessStrip scene={scene} palette={palette} enter={enter} layout={layout} /> : null}
      {displayMode === 'data' ? <DataPanel scene={scene} palette={palette} enter={enter} progress={progress} layout={layout} /> : null}
      {displayMode === 'contrast' ? <ContrastPanel scene={scene} palette={palette} enter={enter} layout={layout} /> : null}
      {displayMode === 'timeline' ? <TimelinePanel scene={scene} palette={palette} enter={enter} layout={layout} /> : null}
      {displayMode === 'matrix' ? <MatrixPanel scene={scene} palette={palette} enter={enter} layout={layout} /> : null}
      {displayMode === 'network' ? <NetworkPanel scene={scene} palette={palette} enter={enter} progress={progress} layout={layout} /> : null}
      {displayMode === 'pyramid' ? <PyramidPanel scene={scene} palette={palette} enter={enter} layout={layout} /> : null}
      {displayMode === 'checklist' ? <ChecklistPanel scene={scene} palette={palette} enter={enter} layout={layout} /> : null}
      {displayMode === 'cta' ? <CtaPanel scene={scene} palette={palette} enter={enter} layout={layout} /> : null}
      <Keywords scene={scene} palette={palette} enter={enter} layout={layout} />
      <SubtitleBar scene={scene} palette={palette} frame={frame} layout={layout} />
    </AbsoluteFill>
  );
}

export function AiExplainerShort(input: RemotionVideoInput) {
  const palette = palettes[input.project.visualPreset || 'clarity-blue'] || palettes['clarity-blue'];
  return (
    <AbsoluteFill style={{ background: palette.bg, fontFamily: 'Inter, Arial, "PingFang SC", "Microsoft YaHei", sans-serif' }}>
      {input.scenes.map((scene, index) => (
        <Sequence key={scene.id} from={getSceneStart(input.scenes, index)} durationInFrames={sceneFrames(scene)}>
          {scene.audioPath ? <Audio src={staticFile(scene.audioPath.replace(/^\//, ''))} /> : null}
          <SceneVisual input={input} scene={scene} sceneIndex={index} sceneCount={input.scenes.length} palette={palette} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
