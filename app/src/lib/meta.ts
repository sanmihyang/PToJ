import type { Board } from '../data/types'

export const META_KEY = 'ptoj:meta'
const DAY_MS = 24 * 60 * 60 * 1000
export const BACKUP_INTERVAL_DAYS = 7

/** 화면 상태성 정보 (데이터와 별도로 저장) */
export interface Meta {
  lastBackupAt?: string
  backupNoticeDismissedAt?: string
}

export function readMeta(storage: Storage = window.localStorage): Meta {
  try {
    const raw = storage.getItem(META_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const o = parsed as Record<string, unknown>
    return {
      lastBackupAt: typeof o.lastBackupAt === 'string' ? o.lastBackupAt : undefined,
      backupNoticeDismissedAt:
        typeof o.backupNoticeDismissedAt === 'string' ? o.backupNoticeDismissedAt : undefined,
    }
  } catch {
    return {}
  }
}

/** 저장 실패는 무시한다 (안내 배너용 정보라 없어도 앱은 동작) */
export function writeMeta(patch: Meta, storage: Storage = window.localStorage): void {
  try {
    storage.setItem(META_KEY, JSON.stringify({ ...readMeta(storage), ...patch }))
  } catch {
    // ignore
  }
}

/**
 * 백업 권장 여부: 보드가 있고, 마지막 백업(없으면 가장 오래된 보드 생성) 후 7일이 지났고,
 * 마지막 백업 이후 변경이 있고, 최근 7일 안에 안내를 닫지 않았을 때.
 */
export function needsBackup(boards: Board[], meta: Meta, now: Date = new Date()): boolean {
  if (boards.length === 0) return false
  const latestChange = boards.map((b) => b.updatedAt).sort().at(-1)!
  if (meta.lastBackupAt && latestChange <= meta.lastBackupAt) return false

  const earliest = boards.map((b) => b.createdAt).sort()[0]
  const baseline = Date.parse(meta.lastBackupAt ?? earliest)
  if (now.getTime() - baseline < BACKUP_INTERVAL_DAYS * DAY_MS) return false

  if (meta.backupNoticeDismissedAt) {
    if (now.getTime() - Date.parse(meta.backupNoticeDismissedAt) < BACKUP_INTERVAL_DAYS * DAY_MS) {
      return false
    }
  }
  return true
}
