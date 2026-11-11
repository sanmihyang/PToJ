import { describe, expect, it } from 'vitest'
import type { Board } from '../data/types'
import { BACKUP_INTERVAL_DAYS, META_KEY, needsBackup, readMeta, writeMeta } from './meta'

const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n))
const iso = (n: number) => day(n).toISOString()

function board(createdDay: number, updatedDay = createdDay): Board {
  return { id: `b${createdDay}`, name: 'b', createdAt: iso(createdDay), updatedAt: iso(updatedDay), cards: [] }
}

describe('needsBackup', () => {
  it('보드가 없으면 필요 없다', () => {
    expect(needsBackup([], {}, day(100))).toBe(false)
  })
  it('백업한 적이 없고 가장 오래된 보드가 7일 지났으면 필요하다', () => {
    expect(needsBackup([board(0)], {}, day(BACKUP_INTERVAL_DAYS))).toBe(true)
    expect(needsBackup([board(0)], {}, day(BACKUP_INTERVAL_DAYS - 1))).toBe(false)
  })
  it('마지막 백업 후 변경이 없으면 필요 없다', () => {
    expect(needsBackup([board(0, 5)], { lastBackupAt: iso(5) }, day(100))).toBe(false)
    expect(needsBackup([board(0, 4)], { lastBackupAt: iso(5) }, day(100))).toBe(false)
  })
  it('백업 후 변경이 있고 7일이 지났으면 필요하다', () => {
    expect(needsBackup([board(0, 6)], { lastBackupAt: iso(5) }, day(12))).toBe(true)
    expect(needsBackup([board(0, 6)], { lastBackupAt: iso(5) }, day(11))).toBe(false) // 백업 후 6일
  })
  it('안내를 닫았으면 7일 동안은 다시 띄우지 않는다', () => {
    const meta = { lastBackupAt: iso(0), backupNoticeDismissedAt: iso(20) }
    expect(needsBackup([board(0, 10)], meta, day(26))).toBe(false)
    expect(needsBackup([board(0, 10)], meta, day(27))).toBe(true)
  })
  it('가장 최근에 바뀐 보드를 기준으로 한다', () => {
    expect(needsBackup([board(0, 1), board(0, 9)], { lastBackupAt: iso(5) }, day(20))).toBe(true)
  })
})

describe('readMeta / writeMeta', () => {
  class Mem implements Pick<Storage, 'getItem' | 'setItem'> {
    map = new Map<string, string>()
    getItem(k: string) { return this.map.get(k) ?? null }
    setItem(k: string, v: string) { this.map.set(k, v) }
  }
  const mem = () => new Mem() as unknown as Storage

  it('기본값은 빈 객체이고 깨진 값은 무시한다', () => {
    const s = mem()
    expect(readMeta(s)).toEqual({})
    s.setItem(META_KEY, '{깨짐')
    expect(readMeta(s)).toEqual({})
    s.setItem(META_KEY, '[1]')
    expect(readMeta(s)).toEqual({})
  })
  it('일부만 갱신해도 나머지는 유지한다', () => {
    const s = mem()
    writeMeta({ lastBackupAt: 'A' }, s)
    writeMeta({ backupNoticeDismissedAt: 'B' }, s)
    expect(readMeta(s)).toEqual({ lastBackupAt: 'A', backupNoticeDismissedAt: 'B' })
  })
  it('저장이 막혀도 예외를 던지지 않는다', () => {
    const s = { getItem: () => null, setItem: () => { throw new Error('denied') } } as unknown as Storage
    expect(() => writeMeta({ lastBackupAt: 'A' }, s)).not.toThrow()
  })
})
