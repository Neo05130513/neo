import { nowIso, readJsonFile, simpleId, writeJsonFile } from './storage';
import type { AuditLog, UserAccount } from './types';

export async function appendAuditLog(input: {
  actor: Pick<UserAccount, 'id' | 'name' | 'role'>;
  action: string;
  targetType: AuditLog['targetType'];
  targetId: string;
  summary: string;
}) {
  const logs = await readJsonFile<AuditLog[]>('data/audit-logs.json').catch(() => []);
  const entry: AuditLog = {
    id: simpleId('audit'),
    actorId: input.actor.id,
    actorName: input.actor.name,
    actorRole: input.actor.role,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    summary: input.summary,
    createdAt: nowIso()
  };
  await writeJsonFile('data/audit-logs.json', [entry, ...logs]);
  return entry;
}

export async function listAuditLogsByTarget(targetType: AuditLog['targetType'], targetId: string) {
  const logs = await readJsonFile<AuditLog[]>('data/audit-logs.json').catch(() => []);
  return logs.filter((item) => item.targetType === targetType && item.targetId === targetId);
}

export async function listAuditLogs() {
  return readJsonFile<AuditLog[]>('data/audit-logs.json').catch(() => []);
}

