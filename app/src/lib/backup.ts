import type { AppData, Board } from '../data/types'
import { dateStamp, downloadBlob, sanitizeFileName } from './files'
import { writeMeta } from './meta'
import { boardToFilePayload, boardsToBackupPayload } from './shareFormat'

const jsonBlob = (payload: unknown) =>
  new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })

/** 보드 1개 → 파일 이름 (예: 제주 여행.ptoj.json) */
export function boardFileName(board: Board): string {
  return `${sanitizeFileName(board.name, '보드')}.ptoj.json`
}

export function boardJsonBlob(board: Board): Blob {
  return jsonBlob(boardToFilePayload(board))
}

export function saveBoardFile(board: Board): void {
  downloadBlob(boardJsonBlob(board), boardFileName(board))
}

/** 전체 백업 파일을 저장하고 마지막 백업 시각을 기록한다 */
export function saveBackup(data: AppData, now: Date = new Date()): void {
  downloadBlob(jsonBlob(boardsToBackupPayload(data)), `ptoj-backup-${dateStamp(now)}.json`)
  writeMeta({ lastBackupAt: now.toISOString() })
}

export function countCards(boards: Board[]): number {
  return boards.reduce((n, b) => n + b.cards.length, 0)
}
