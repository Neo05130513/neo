'use client';

import { useState } from 'react';
import { primaryButtonStyle, secondaryButtonStyle, StatusBadge, subtlePanelStyle } from '../_components/studio-ui';
import type { DeviceInfo } from '@/lib/performance/device-info';
import type { PerformanceSettings } from '@/lib/performance/settings';

export function PerformanceSettingsClient({
  initialDevice,
  initialSettings,
  recommended
}: {
  initialDevice: DeviceInfo;
  initialSettings: PerformanceSettings;
  recommended: PerformanceSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [device, setDevice] = useState(initialDevice);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(nextSettings: PerformanceSettings) {
    setBusy(true);
    setMessage('正在保存性能设置...');
    try {
      const response = await fetch('/api/performance/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextSettings)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || '保存失败');
      setSettings(payload.settings);
      setDevice(payload.device);
      setMessage('性能设置已保存。新的后台任务会使用这套并发限制。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  function updateNumber(key: keyof PerformanceSettings, value: number) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  const warning = settings.renderConcurrency > recommended.renderConcurrency || settings.totalTaskConcurrency > recommended.totalTaskConcurrency;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <Info label="CPU" value={device.cpuModel} />
        <Info label="线程" value={`${device.cpuThreads}`} />
        <Info label="内存" value={`${device.totalMemoryGb}GB / 可用 ${device.freeMemoryGb}GB`} />
        <Info label="显卡" value={device.gpuModels.length ? device.gpuModels.join(' / ') : '未识别'} />
      </div>

      <div style={{ ...subtlePanelStyle, padding: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <strong>推荐档位：{tierLabel(device.deviceTier)}</strong>
          <span style={{ color: '#94a3b8', lineHeight: 1.6 }}>推荐：后台任务 {recommended.totalTaskConcurrency}，渲染 {recommended.renderConcurrency}，旁白 {recommended.ttsConcurrency}，画面 {recommended.imageConcurrency}</span>
        </div>
        <button type="button" onClick={() => save(recommended)} disabled={busy} style={secondaryButtonStyle}>使用推荐值</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 }}>
        <NumberField label="后台任务" value={settings.totalTaskConcurrency} min={1} max={8} onChange={(value) => updateNumber('totalTaskConcurrency', value)} />
        <NumberField label="渲染并发" value={settings.renderConcurrency} min={1} max={3} onChange={(value) => updateNumber('renderConcurrency', value)} />
        <NumberField label="旁白并发" value={settings.ttsConcurrency} min={1} max={8} onChange={(value) => updateNumber('ttsConcurrency', value)} />
        <NumberField label="画面并发" value={settings.imageConcurrency} min={1} max={6} onChange={(value) => updateNumber('imageConcurrency', value)} />
        <NumberField label="队列容量" value={settings.queueCapacity} min={1} max={100} onChange={(value) => updateNumber('queueCapacity', value)} />
        <NumberField label="低内存阈值GB" value={settings.lowMemoryThresholdGb} min={0} max={32} onChange={(value) => updateNumber('lowMemoryThresholdGb', value)} />
      </div>

      <label style={{ ...subtlePanelStyle, padding: 12, display: 'flex', gap: 10, alignItems: 'center', color: '#cbd5e1' }}>
        <input type="checkbox" checked={settings.autoPauseOnLowMemory} onChange={(event) => setSettings((current) => ({ ...current, autoPauseOnLowMemory: event.target.checked }))} />
        可用内存低于 {settings.lowMemoryThresholdGb}GB 时暂停启动新的渲染任务，关闭后会继续运行但电脑可能变慢
      </label>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => save(settings)} disabled={busy} style={primaryButtonStyle}>{busy ? '保存中...' : '保存性能设置'}</button>
        {warning ? <StatusBadge text="高于推荐，可能卡顿" tone="warning" /> : <StatusBadge text="设置较稳" tone="success" />}
      </div>
      {message ? <div style={{ color: '#93c5fd', lineHeight: 1.7 }}>{message}</div> : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...subtlePanelStyle, padding: 12, display: 'grid', gap: 5, minWidth: 0 }}>
      <span style={{ color: '#7f8da3', fontSize: 12 }}>{label}</span>
      <strong style={{ color: '#e2e8f0', wordBreak: 'break-word', lineHeight: 1.4 }}>{value}</strong>
    </div>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label style={{ ...subtlePanelStyle, padding: 12, display: 'grid', gap: 7 }}>
      <span style={{ color: '#7f8da3', fontSize: 12 }}>{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} style={{ border: '1px solid #334155', borderRadius: 8, background: '#0f141d', color: '#f8fafc', padding: '8px 9px', width: '100%', boxSizing: 'border-box' }} />
    </label>
  );
}

function tierLabel(tier: DeviceInfo['deviceTier']) {
  if (tier === 'workstation') return '高性能工作站';
  if (tier === 'pro') return '专业设备';
  if (tier === 'standard') return '标准设备';
  return '基础设备';
}
