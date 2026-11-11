import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION, type AppData, type Board, type Card } from './types'
import { isValidDate, isValidTime, validateAppData, validateBoard } from './validate'

const ts = '2026-01-01T09:00:00.000Z'

function card(o: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    title: '제목',
    content: '',
    date: '2026-01-03',
    startTime: '09:00',
    endTime: null,
    placeName: null,
    address: null,
    isCompleted: false,
    completedAt: null,
    createdAt: ts,
    updatedAt: ts,
    ...o,
  }
}

function board(o: Partial<Board> = {}): Board {
  return { id: 'b1', name: '여행', createdAt: ts, updatedAt: ts, cards: [card()], ...o }
}

function data(boards: Board[] = [board()]): AppData {
  return { version: SCHEMA_VERSION, boards }
}

const ok = (v: unknown) => validateAppData(v, SCHEMA_VERSION)

describe('날짜/시간 형식', () => {
  it('날짜', () => {
    expect(isValidDate('2026-02-28')).toBe(true)
    expect(isValidDate('2028-02-29')).toBe(true)
    expect(isValidDate('2026-02-29')).toBe(false)
    expect(isValidDate('2026-13-01')).toBe(false)
    expect(isValidDate('2026-1-1')).toBe(false)
  })
  it('시간', () => {
    expect(isValidTime('00:00')).toBe(true)
    expect(isValidTime('23:59')).toBe(true)
    expect(isValidTime('24:00')).toBe(false)
    expect(isValidTime('9:00')).toBe(false)
    expect(isValidTime('12:60')).toBe(false)
  })
})

describe('validateAppData', () => {
  it('올바른 데이터를 통과시킨다', () => {
    const r = ok(data())
    expect(r.ok).toBe(true)
  })

  it('알 수 없는 필드는 제거한다', () => {
    const dirty = data()
    ;(dirty.boards[0] as unknown as Record<string, unknown>).hack = 'x'
    const r = ok(dirty)
    expect(r.ok && 'hack' in r.value.boards[0]).toBe(false)
  })

  it('객체가 아니면 거부한다', () => {
    expect(ok(null).ok).toBe(false)
    expect(ok([]).ok).toBe(false)
    expect(ok('x').ok).toBe(false)
  })

  it('버전이 다르면 거부한다', () => {
    expect(ok({ ...data(), version: 99 }).ok).toBe(false)
    expect(ok({ boards: [] }).ok).toBe(false)
  })

  it('보드 이름 규칙 (비어 있음/30자 초과)', () => {
    expect(ok(data([board({ name: '  ' })])).ok).toBe(false)
    expect(ok(data([board({ name: 'a'.repeat(30) })])).ok).toBe(true)
    expect(ok(data([board({ name: 'a'.repeat(31) })])).ok).toBe(false)
  })

  it('카드 제목/내용 길이', () => {
    expect(ok(data([board({ cards: [card({ title: '' })] })])).ok).toBe(false)
    expect(ok(data([board({ cards: [card({ title: 'a'.repeat(51) })] })])).ok).toBe(false)
    expect(ok(data([board({ cards: [card({ content: 'a'.repeat(501) })] })])).ok).toBe(false)
    expect(ok(data([board({ cards: [card({ content: 'a'.repeat(500) })] })])).ok).toBe(true)
  })

  it('종료 시간은 시작 시간보다 늦어야 한다', () => {
    expect(ok(data([board({ cards: [card({ endTime: '10:00' })] })])).ok).toBe(true)
    expect(ok(data([board({ cards: [card({ endTime: '09:00' })] })])).ok).toBe(false)
    expect(ok(data([board({ cards: [card({ endTime: '08:00' })] })])).ok).toBe(false)
  })

  it('완료 상태와 완료 시각이 일치해야 한다', () => {
    expect(ok(data([board({ cards: [card({ isCompleted: true, completedAt: ts })] })])).ok).toBe(true)
    expect(ok(data([board({ cards: [card({ isCompleted: true, completedAt: null })] })])).ok).toBe(false)
    expect(ok(data([board({ cards: [card({ isCompleted: false, completedAt: ts })] })])).ok).toBe(false)
  })

  it('참석 기능 제거 전에 저장된 데이터(참석 필드 포함)도 읽고, 해당 필드는 버린다', () => {
    const legacy = data()
    Object.assign(legacy.boards[0].cards[0], {
      attendanceEnabled: true,
      attendees: [{ id: 'a1', name: '민수', status: 'yes' }],
    })
    const r = ok(legacy)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect('attendees' in r.value.boards[0].cards[0]).toBe(false)
      expect('attendanceEnabled' in r.value.boards[0].cards[0]).toBe(false)
    }
  })

  it('id 중복을 거부한다', () => {
    expect(ok(data([board(), board()])).ok).toBe(false)
    expect(ok(data([board({ cards: [card(), card()] })])).ok).toBe(false)
  })

  it('잘못된 날짜를 거부한다', () => {
    expect(ok(data([board({ cards: [card({ date: '2026-02-30' })] })])).ok).toBe(false)
  })

  it('오류 메시지에 위치가 포함된다', () => {
    const r = ok(data([board({ cards: [card({ title: '' })] })]))
    expect(!r.ok && r.error).toContain('data.boards[0].cards[0].title')
  })
})

describe('validateBoard', () => {
  it('보드 하나를 검증한다', () => {
    expect(validateBoard(board()).ok).toBe(true)
    expect(validateBoard({ ...board(), cards: 'x' }).ok).toBe(false)
  })
})
