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
  const displayMode = scene.shotType === 'title' ? 'hero' : scene.visualType === 'image' || scene.layout === 'chart' ? 'data' : scene.shotType === 'step' ? 'process' : 'cards';

  return (
    <AbsoluteFill>
      <Background palette={palette} progress={progress} />
      <Header input={input} scene={scene} sceneIndex={sceneIndex} sceneCount={sceneCount} palette={palette} enter={enter} layout={layout} />
      {displayMode === 'hero' ? <HeroPanel scene={scene} palette={palette} enter={enter} layout={layout} /> : null}
      {displayMode === 'cards' ? <InsightCards scene={scene} palette={palette} enter={enter} layout={layout} /> : null}
      {displayMode === 'process' ? <ProcessStrip scene={scene} palette={palette} enter={enter} layout={layout} /> : null}
      {displayMode === 'data' ? <DataPanel scene={scene} palette={palette} enter={enter} progress={progress} layout={layout} /> : null}
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
