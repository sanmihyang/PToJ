import { describe, expect, it } from 'vitest'
import type { Board, Card } from '../data/types'
import {
  ImportError,
  boardToFilePayload,
  boardToLinkPayload,
  boardsToBackupPayload,
  parseImport,
} from './shareFormat'

const ts = '2026-01-01T09:00:00.000Z'

function card(o: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    title: '점심',
    content: '예약 12시 반',
    date: '2026-01-03',
    startTime: '12:00',
    endTime: '13:30',
    placeName: '카페 모닝',
    address: '서울 강남구 테헤란로 1',
    isCompleted: true,
    completedAt: '2026-01-03T03:30:00.000Z',
    createdAt: ts,
    updatedAt: ts,
    ...o,
  }
}

function board(o: Partial<Board> = {}): Board {
  return { id: 'b1', name: '제주 여행', createdAt: ts, updatedAt: ts, cards: [card()], ...o }
}

const parse = (v: unknown) => parseImport(JSON.stringify(v), ts)

describe('JSON 파일 (보드 1개)', () => {
  it('내보낸 것을 그대로 읽는다', () => {
    const r = parse(boardToFilePayload(board()))
    expect(r).toEqual({ kind: 'board', board: board() })
  })
})

describe('전체 백업', () => {
  it('보드 여러 개를 읽는다', () => {
    const data = { version: 1, boards: [board(), board({ id: 'b2', name: '부산', cards: [] })] }
    const r = parse(boardsToBackupPayload(data))
    expect(r.kind).toBe('backup')
    if (r.kind === 'backup') expect(r.boards.map((b) => b.name)).toEqual(['제주 여행', '부산'])
  })
  it('보드가 하나라도 잘못되면 전체를 거부한다', () => {
    const bad = { ...board({ id: 'b2' }), name: '' }
    expect(() => parse({ app: 'ptoj', version: 1, backup: true, boards: [board(), bad] })).toThrowError(ImportError)
  })
  it('빈 백업도 읽는다', () => {
    expect(parse({ app: 'ptoj', version: 1, backup: true, boards: [] })).toEqual({ kind: 'backup', boards: [] })
  })
})

describe('링크용 압축 형식', () => {
  it('ID/빈 값을 생략해 더 짧다', () => {
    const full = JSON.stringify(boardToFilePayload(board()))
    const compact = JSON.stringify(boardToLinkPayload(board()))
    expect(compact.length).toBeLessThan(full.length)
    expect(compact).not.toContain('"id"')
    expect(compact).not.toContain('updatedAt')
  })

  it('왕복하면 내용이 같다 (ID/수정 시각 제외)', () => {
    const r = parse(boardToLinkPayload(board()))
    expect(r.kind).toBe('board')
    if (r.kind !== 'board') return
    const [orig] = board().cards
    const [got] = r.board.cards
    expect({ ...got, id: '', updatedAt: '' }).toEqual({ ...orig, id: '', updatedAt: '' })
    expect(r.board.name).toBe('제주 여행')
  })

  it('비어 있는 값(내용/종료/위치/완료)이 생략된 카드도 올바르게 복원한다', () => {
    const plain = card({ content: '', endTime: null, placeName: null, address: null, isCompleted: false, completedAt: null })
    const r = parse(boardToLinkPayload(board({ cards: [plain] })))
    if (r.kind !== 'board') throw new Error('board expected')
    const c = r.board.cards[0]
    expect(c.content).toBe('')
    expect(c.endTime).toBeNull()
    expect(c.placeName).toBeNull()
    expect(c.isCompleted).toBe(false)
    expect(c.completedAt).toBeNull()
  })

  it('카드 작성 시각(좌우 배치 기준)을 유지한다', () => {
    const a = card({ id: 'a', createdAt: '2026-01-01T09:00:00.000Z' })
    const b = card({ id: 'b', createdAt: '2026-01-01T09:05:00.000Z' })
    const r = parse(boardToLinkPayload(board({ cards: [a, b] })))
    if (r.kind !== 'board') throw new Error('board expected')
    expect(r.board.cards.map((c) => c.createdAt)).toEqual([a.createdAt, b.createdAt])
  })

  it('카드마다 서로 다른 임시 ID가 생긴다', () => {
    const r = parse(boardToLinkPayload(board({ cards: [card({ id: 'a' }), card({ id: 'b' })] })))
    if (r.kind !== 'board') throw new Error('board expected')
    expect(new Set(r.board.cards.map((c) => c.id)).size).toBe(2)
  })
})

describe('잘못된 입력은 ImportError로 거부', () => {
  const err = (text: string) => {
    try {
      parseImport(text, ts)
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError)
      return (e as Error).message
    }
    throw new Error('거부되어야 합니다')
  }

  it('JSON이 아님', () => expect(err('안녕하세요')).toContain('JSON'))
  it('다른 앱의 파일', () => {
    expect(err(JSON.stringify({ hello: 'world' }))).toContain('이 앱에서 만든')
    expect(err(JSON.stringify([1, 2]))).toContain('이 앱에서 만든')
    expect(err('null')).toContain('이 앱에서 만든')
  })
  it('지원하지 않는 버전', () => {
    expect(err(JSON.stringify({ app: 'ptoj', version: 2, board: board() }))).toContain('버전')
    expect(err(JSON.stringify({ app: 'ptoj', board: board() }))).toContain('버전')
  })
  it('보드 데이터가 없음', () => expect(err(JSON.stringify({ app: 'ptoj', version: 1 }))).toContain('보드 데이터'))
  it('보드 내용이 규칙에 어긋남', () => {
    expect(err(JSON.stringify({ app: 'ptoj', version: 1, board: board({ name: '' }) }))).toContain('형식')
    const badDate = board({ cards: [card({ date: '2026-02-30' })] })
    expect(err(JSON.stringify({ app: 'ptoj', version: 1, board: badDate }))).toContain('날짜')
    const longTitle = board({ cards: [card({ title: '가'.repeat(51) })] })
    expect(err(JSON.stringify({ app: 'ptoj', version: 1, board: longTitle }))).toContain('50자')
  })
  it('백업 형식이 아님', () => {
    expect(err(JSON.stringify({ app: 'ptoj', version: 1, backup: true, boards: 'x' }))).toContain('백업')
  })
  it('너무 큰 입력', () => expect(err('x'.repeat(5_000_001))).toContain('너무 큽니다'))
})

describe('안전성', () => {
  it('알 수 없는 필드(옛 참석 필드 등)는 버린다', () => {
    const dirty = board()
    Object.assign(dirty.cards[0], { attendees: [{ id: 'x', name: 'y', status: 'yes' }], hack: '<script>' })
    const r = parse(boardToFilePayload(dirty))
    if (r.kind !== 'board') throw new Error('board expected')
    expect('attendees' in r.board.cards[0]).toBe(false)
    expect('hack' in r.board.cards[0]).toBe(false)
  })
})
