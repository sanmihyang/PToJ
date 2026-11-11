import { describe, expect, it } from 'vitest'
import {
  dayHeading,
  groupByDay,
  isInRange,
  periodLabel,
  periodRange,
  shiftPeriod,
  weekStart,
} from './period'

describe('주는 월요일부터 일요일까지', () => {
  // 2026-01-05 = 월요일
  it('월~일 모두 같은 주의 월요일을 가리킨다', () => {
    for (const d of ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11']) {
      expect(weekStart(d)).toBe('2026-01-05')
    }
  })
  it('일요일은 그 전 월요일에 속하고, 다음 월요일은 새 주', () => {
    expect(weekStart('2026-01-04')).toBe('2025-12-29')
    expect(weekStart('2026-01-12')).toBe('2026-01-12')
  })
  it('주 범위는 월~일 7일, 월/연을 넘나든다', () => {
    expect(periodRange('2026-01-03', 'week')).toEqual({ start: '2025-12-29', end: '2026-01-04' })
    expect(periodRange('2026-01-07', 'week')).toEqual({ start: '2026-01-05', end: '2026-01-11' })
  })
})

describe('periodRange', () => {
  it('일', () => {
    expect(periodRange('2026-03-15', 'day')).toEqual({ start: '2026-03-15', end: '2026-03-15' })
  })
  it('월: 말일(평년/윤년/30일/31일)', () => {
    expect(periodRange('2026-02-10', 'month')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(periodRange('2028-02-10', 'month')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
    expect(periodRange('2026-04-30', 'month')).toEqual({ start: '2026-04-01', end: '2026-04-30' })
    expect(periodRange('2026-12-01', 'month')).toEqual({ start: '2026-12-01', end: '2026-12-31' })
  })
  it('연', () => {
    expect(periodRange('2026-06-15', 'year')).toEqual({ start: '2026-01-01', end: '2026-12-31' })
  })
})

describe('shiftPeriod', () => {
  it('일/주', () => {
    expect(shiftPeriod('2026-01-01', 'day', -1)).toBe('2025-12-31')
    expect(shiftPeriod('2026-01-05', 'week', 1)).toBe('2026-01-12')
    expect(shiftPeriod('2026-01-05', 'week', -1)).toBe('2025-12-29')
  })
  it('월: 말일을 넘지 않게 맞추고 연을 넘나든다', () => {
    expect(shiftPeriod('2026-01-31', 'month', 1)).toBe('2026-02-28')
    expect(shiftPeriod('2028-01-31', 'month', 1)).toBe('2028-02-29')
    expect(shiftPeriod('2026-03-31', 'month', -1)).toBe('2026-02-28')
    expect(shiftPeriod('2026-12-15', 'month', 1)).toBe('2027-01-15')
    expect(shiftPeriod('2026-01-15', 'month', -1)).toBe('2025-12-15')
  })
  it('연: 2/29는 평년 2/28로', () => {
    expect(shiftPeriod('2026-06-15', 'year', 1)).toBe('2027-06-15')
    expect(shiftPeriod('2028-02-29', 'year', 1)).toBe('2029-02-28')
    expect(shiftPeriod('2028-02-29', 'year', -1)).toBe('2027-02-28')
  })
  it('이동한 날짜가 속한 기간은 이전/다음 기간이다 (월)', () => {
    const next = shiftPeriod('2026-01-31', 'month', 1)
    expect(periodRange(next, 'month').start).toBe('2026-02-01')
  })
})

describe('표시 형식', () => {
  it('기간 이름', () => {
    expect(periodLabel('2026-01-03', 'day')).toBe('2026.01.03')
    expect(periodLabel('2026-01-07', 'week')).toBe('2026.01.05 ~ 01.11')
    expect(periodLabel('2026-01-03', 'week')).toBe('2025.12.29 ~ 2026.01.04') // 연을 넘으면 연도 표시
    expect(periodLabel('2026-01-03', 'month')).toBe('2026.01')
    expect(periodLabel('2026-01-03', 'year')).toBe('2026')
  })
  it('날짜 제목에 요일을 붙인다', () => {
    expect(dayHeading('2026-01-03', false)).toBe('01.03 (토)')
    expect(dayHeading('2026-01-04', false)).toBe('01.04 (일)')
    expect(dayHeading('2026-01-05', true)).toBe('2026.01.05 (월)')
  })
})

describe('groupByDay', () => {
  const c = (id: string, date: string) => ({ id, date })
  const range = { start: '2026-01-05', end: '2026-01-11' }

  it('기간 안의 카드만 날짜별로 묶고 날짜순으로 정렬한다', () => {
    const groups = groupByDay(
      [c('c', '2026-01-09'), c('a', '2026-01-05'), c('b', '2026-01-05'), c('x', '2026-01-04'), c('y', '2026-01-12')],
      range,
    )
    expect(groups.map((g) => g.date)).toEqual(['2026-01-05', '2026-01-09'])
    expect(groups[0].cards.map((x) => x.id)).toEqual(['a', 'b'])
  })
  it('경계(시작일/종료일)를 포함한다', () => {
    const groups = groupByDay([c('a', '2026-01-05'), c('b', '2026-01-11')], range)
    expect(groups.map((g) => g.date)).toEqual(['2026-01-05', '2026-01-11'])
  })
  it('카드가 없으면 빈 배열', () => {
    expect(groupByDay([], range)).toEqual([])
    expect(groupByDay([c('x', '2026-02-01')], range)).toEqual([])
  })
  it('isInRange', () => {
    expect(isInRange('2026-01-05', range)).toBe(true)
    expect(isInRange('2026-01-12', range)).toBe(false)
  })
})
