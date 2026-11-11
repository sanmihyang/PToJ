import { describe, expect, it } from 'vitest'
import type { Card } from '../data'
import { buildEdges, layoutCards, overlaps } from './layout'

let seq = 0
function card(id: string, start: string, end: string | null = null, created?: number): Card {
  const n = created ?? ++seq
  return {
    id,
    title: id,
    content: '',
    date: '2026-01-03',
    startTime: start,
    endTime: end,
    placeName: null,
    address: null,
    isCompleted: false,
    completedAt: null,
    attendanceEnabled: false,
    attendees: [],
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString(),
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

const ids = (rows: ReturnType<typeof layoutCards>) => rows.map((r) => r.cards.map((p) => p.card.id))

describe('겹침 판정', () => {
  it('구간끼리: 맞닿기만 하면 겹치지 않는다', () => {
    expect(overlaps(card('a', '09:00', '10:00'), card('b', '10:00', '11:00'))).toBe(false)
    expect(overlaps(card('a', '09:00', '10:01'), card('b', '10:00', '11:00'))).toBe(true)
  })
  it('종료 없음=시작 시점: 구간 안에 들어오면 겹침, 종료 시각과 같으면 안 겹침', () => {
    const range = card('r', '12:00', '13:30')
    expect(overlaps(range, card('p', '12:30'))).toBe(true)
    expect(overlaps(range, card('p', '12:00'))).toBe(true)
    expect(overlaps(range, card('p', '13:30'))).toBe(false)
    expect(overlaps(range, card('p', '11:59'))).toBe(false)
  })
  it('시점끼리: 시작 시간이 같을 때만 겹침', () => {
    expect(overlaps(card('a', '09:00'), card('b', '09:00'))).toBe(true)
    expect(overlaps(card('a', '09:00'), card('b', '09:01'))).toBe(false)
  })
})

describe('layoutCards', () => {
  it('카드가 없으면 빈 배열', () => {
    expect(layoutCards([])).toEqual([])
  })

  it('단일 카드 한 줄', () => {
    const rows = layoutCards([card('a', '09:00')])
    expect(ids(rows)).toEqual([['a']])
    expect(rows[0].columns).toBe(1)
    expect(rows[0].cards[0].offset).toBe(0)
  })

  it('겹치지 않으면 시작 시간 순으로 줄이 쌓인다 (입력 순서와 무관)', () => {
    const rows = layoutCards([card('c', '12:00'), card('a', '09:00', '10:00'), card('b', '10:00', '11:00')])
    expect(ids(rows)).toEqual([['a'], ['b'], ['c']])
  })

  it('겹치면 같은 줄에서 먼저 작성된 카드가 왼쪽', () => {
    // b가 시작은 늦지만 먼저 작성됨
    const late = card('late', '09:30', '10:30', 2)
    const early = card('early', '09:00', '10:00', 1)
    const rows = layoutCards([early, late])
    expect(rows).toHaveLength(1)
    expect(rows[0].columns).toBe(2)
    expect(rows[0].cards.find((p) => p.card.id === 'early')!.col).toBe(0)
    expect(rows[0].cards.find((p) => p.card.id === 'late')!.col).toBe(1)

    // 작성 순서를 뒤집으면 좌우도 뒤집힌다
    const rows2 = layoutCards([card('x', '09:00', '10:00', 2), card('y', '09:30', '10:30', 1)])
    expect(rows2[0].cards.find((p) => p.card.id === 'y')!.col).toBe(0)
    expect(rows2[0].cards.find((p) => p.card.id === 'x')!.col).toBe(1)
  })

  it('시작이 늦은 카드는 줄 안에서 아래로 내려간다 (offset)', () => {
    const rows = layoutCards([card('a', '09:00', '11:00', 1), card('b', '10:00', '11:00', 2)])
    const [a, b] = ['a', 'b'].map((id) => rows[0].cards.find((p) => p.card.id === id)!)
    expect(a.offset).toBe(0)
    expect(b.offset).toBeCloseTo(0.5)
  })

  it('3개가 모두 겹치면 3열', () => {
    const rows = layoutCards([
      card('a', '09:00', '12:00', 1),
      card('b', '10:00', '12:00', 2),
      card('c', '11:00', '12:00', 3),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].columns).toBe(3)
    expect(rows[0].cards.map((p) => p.col).sort()).toEqual([0, 1, 2])
  })

  it('겹침이 이어지면(a-b, b-c) 한 줄이고, 겹치지 않는 a와 c는 같은 열을 쓸 수 있다', () => {
    const rows = layoutCards([
      card('a', '09:00', '10:00', 1),
      card('b', '09:30', '11:30', 2),
      card('c', '11:00', '12:00', 3),
    ])
    expect(rows).toHaveLength(1)
    const col = (id: string) => rows[0].cards.find((p) => p.card.id === id)!.col
    expect(col('a')).toBe(0)
    expect(col('b')).toBe(1)
    expect(col('c')).toBe(0)
    expect(rows[0].columns).toBe(2)
  })

  it('종료 시간 없는 카드: 같은 시작 시간이면 좌우, 다르면 별도 줄', () => {
    expect(layoutCards([card('a', '09:00'), card('b', '09:00')])[0].columns).toBe(2)
    expect(layoutCards([card('a', '09:00'), card('b', '09:01')])).toHaveLength(2)
  })

  it('긴 일정 안에 시점 카드가 있으면 같은 줄', () => {
    const rows = layoutCards([card('long', '12:00', '13:30', 1), card('dot', '12:30', null, 2)])
    expect(rows).toHaveLength(1)
    expect(rows[0].columns).toBe(2)
  })

  it('같은 열에서는 시작 시간 순으로 정렬된다', () => {
    const rows = layoutCards([
      card('a', '09:00', '10:00', 1),
      card('b', '09:30', '11:30', 2),
      card('c', '11:00', '12:00', 3),
    ])
    const col0 = rows[0].cards.filter((p) => p.col === 0).map((p) => p.card.id)
    expect(col0).toEqual(['a', 'c'])
  })
})

describe('buildEdges', () => {
  it('다음 줄의 모든 카드로 이어지는 vertical 연결', () => {
    const rows = layoutCards([
      card('a', '09:00', '10:00', 1),
      card('b', '09:00', '10:00', 2),
      card('c', '12:00', null, 3),
    ])
    const edges = buildEdges(rows)
    const vertical = edges.filter((e) => e.kind === 'vertical')
    expect(vertical.map((e) => `${e.from}>${e.to}`).sort()).toEqual(['a>c', 'b>c'])
  })

  it('같은 줄의 겹치는 인접 열은 horizontal 연결 (왼쪽 → 오른쪽)', () => {
    const rows = layoutCards([card('a', '09:00', '10:00', 1), card('b', '09:00', '10:00', 2)])
    const edges = buildEdges(rows)
    expect(edges).toEqual([{ from: 'a', to: 'b', kind: 'horizontal' }])
  })

  it('겹치지 않는 카드끼리는 horizontal 연결이 없다', () => {
    const rows = layoutCards([
      card('a', '09:00', '10:00', 1),
      card('b', '09:30', '11:30', 2),
      card('c', '11:00', '12:00', 3),
    ])
    const h = buildEdges(rows).filter((e) => e.kind === 'horizontal')
    expect(h.map((e) => `${e.from}-${e.to}`).sort()).toEqual(['a-b', 'c-b'].sort())
  })

  it('카드가 하나면 연결이 없다', () => {
    expect(buildEdges(layoutCards([card('a', '09:00')]))).toEqual([])
  })
})
