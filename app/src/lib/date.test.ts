import { expect, it } from 'vitest'
import { addDays, formatDay, todayStr } from './date'

it('오늘 날짜는 로컬 기준', () => {
  expect(todayStr(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  expect(todayStr(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31')
})

it('날짜 이동: 월말/연말/윤년', () => {
  expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
})

it('표시 형식', () => {
  expect(formatDay('2026-01-03')).toBe('2026.01.03')
})
