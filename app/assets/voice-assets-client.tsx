'use client';

import { useState } from 'react';
import { EmptyGuide, primaryButtonStyle, secondaryButtonStyle, StatusBadge } from '../_components/studio-ui';

type VoiceProfileView = {
  id: string;
  name: string;
  provider: string;
  status: 'sample_uploaded' | 'ready' | 'failed';
  isDefault?: boolean;
  lastError?: string;
  samplePath?: string;
  providerVoiceId?: string;
  createdAt: string;
};

function statusMeta(status: VoiceProfileView['status']) {
  if (status === 'ready') return { text: '复刻完成', tone: 'success' as const };
  if (status === 'failed') return { text: '复刻失败', tone: 'danger' as const };
  return { text: '样本已上传', tone: 'warning' as const };
}

function formatProvider(provider: string) {
  if (provider === 'aliyun-cosyvoice') return 'CosyVoice';
  if (provider === 'minimax') return 'MiniMax';
  return '自定义接口';
}

export function VoiceAssetsClient({ initialVoices }: { initialVoices: VoiceProfileView[] }) {
  const [voices, setVoices] = useState(initialVoices);
  const [voiceName, setVoiceName] = useState('我的声音');
  const [sample, setSample] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [openVoiceId, setOpenVoiceId] = useState<string | null>(null);

  async function reloadVoices() {
    const response = await fetch('/api/voices/profiles', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '加载声音列表失败');
    setVoices(payload.profiles || []);
  }

  async function uploadVoice() {
    if (!sample) {
      setMessage('请先选择一段声音样本。');
      return;
    }

    setBusy('upload');
    setMessage('正在上传样本并复刻声音...');
    try {
      const form = new FormData();
      form.append('sample', sample);
      form.append('name', voiceName);
      const response = await fetch('/api/voices/upload', { method: 'POST', body: form });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.profile) setVoices((current) => [payload.profile, ...current.filter((voice) => voice.id !== payload.profile.id)]);
        throw new Error(payload.error || '声音复刻失败');
      }
      await reloadVoices();
      setSample(null);
      setMessage(payload.profile?.status === 'ready' ? '声音复刻完成，已可在开始制作中选择。' : '声音样本已保存。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '声音上传失败');
    } finally {
      setBusy('');
    }
  }

  async function retryVoice(profileId: string) {
    setBusy(`retry:${profileId}`);
    setMessage('正在重试声音复刻...');
    try {
      const response = await fetch(`/api/voices/profiles/${profileId}/retry`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.profile) setVoices((current) => current.map((voice) => voice.id === profileId ? payload.profile : voice));
        throw new Error(payload.error || '重试声音复刻失败');
      }
      await reloadVoices();
      setMessage('声音复刻成功。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '重试声音复刻失败');
    } finally {
      setBusy('');
    }
  }

  async function setDefaultVoice(profileId: string) {
    setBusy(`default:${profileId}`);
    setMessage('正在设置默认音色...');
    try {
      const response = await fetch(`/api/voices/profiles/${profileId}/default`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '设置默认音色失败');
      await reloadVoices();
      setMessage(`默认音色已设置为：${payload.profile?.name || profileId}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '设置默认音色失败');
    } finally {
      setBusy('');
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ borderRadius: 12, border: '1px solid #263244', background: '#111823', padding: 16, display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <strong>上传新声音</strong>
          <span style={{ color: '#94a3b8', lineHeight: 1.6 }}>上传 10-30 秒清晰语音，系统会复刻成可用于视频旁白的音色。</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr auto', gap: 10, alignItems: 'center' }}>
          <input value={voiceName} onChange={(event) => setVoiceName(event.target.value)} placeholder="声音名称" style={inputStyle} />
          <input type="file" accept="audio/*" onChange={(event) => setSample(event.target.files?.[0] || null)} style={inputStyle} />
          <button type="button" onClick={uploadVoice} disabled={busy === 'upload'} style={primaryButtonStyle}>{busy === 'upload' ? '复刻中...' : '上传并复刻'}</button>
        </div>
      </section>

      {message ? <div style={{ borderRadius: 10, border: '1px solid #334155', background: '#0f141d', color: '#dbeafe', padding: 12, lineHeight: 1.6 }}>{message}</div> : null}

      {!voices.length ? (
        <EmptyGuide title="还没有声音" text="上传第一段声音样本，复刻完成后就可以在开始制作页选择这个音色。" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
          {voices.map((voice) => {
            const status = statusMeta(voice.status);
            return (
              <article key={voice.id} style={{ borderRadius: 12, border: '1px solid #263244', background: '#111823', padding: 15, display: 'grid', gap: 11 }}>
                <button
                  type="button"
                  onClick={() => setOpenVoiceId((current) => current === voice.id ? null : voice.id)}
                  style={{ all: 'unset', cursor: 'pointer', display: 'grid', gap: 11 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}>
                    <strong>{voice.name}</strong>
                    <StatusBadge text={voice.isDefault ? '默认' : status.text} tone={voice.isDefault ? 'info' : status.tone} />
                  </div>
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>服务：{formatProvider(voice.provider)}</span>
                  <span style={{ color: '#64748b', fontSize: 12 }}>{new Date(voice.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
                  <span style={{ color: '#7dd3fc', fontSize: 12 }}>{openVoiceId === voice.id ? '收起详情' : '点击查看详情'}</span>
                </button>
                {openVoiceId === voice.id ? (
                  <div style={{ borderRadius: 10, border: '1px solid #243042', background: '#0f141d', padding: 12, display: 'grid', gap: 9 }}>
                    <InfoLine label="状态" value={status.text} />
                    <InfoLine label="音色 ID" value={voice.providerVoiceId || '未生成'} />
                    <InfoLine label="样本路径" value={voice.samplePath || '无'} />
                    {voice.samplePath ? <audio src={voice.samplePath} controls style={{ width: '100%' }} /> : null}
                  </div>
                ) : null}
                {voice.lastError ? <span style={{ color: '#fecaca', lineHeight: 1.55 }}>{voice.lastError}</span> : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {voice.status === 'ready' && !voice.isDefault ? <button type="button" onClick={() => setDefaultVoice(voice.id)} style={secondaryButtonStyle}>设为默认</button> : null}
                  {voice.status === 'failed' || voice.status === 'sample_uploaded' ? <button type="button" onClick={() => retryVoice(voice.id)} style={secondaryButtonStyle}>重试复刻</button> : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <span style={{ color: '#64748b', fontSize: 12 }}>{label}</span>
      <strong style={{ color: '#cbd5e1', lineHeight: 1.45, wordBreak: 'break-all' }}>{value}</strong>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #334155',
  borderRadius: 10,
  background: '#0f141d',
  color: '#f8fafc',
  padding: '11px 12px',
  outline: 'none'
} as const;
