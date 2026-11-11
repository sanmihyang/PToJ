import { expect, it } from 'vitest'
import { formatDate, timeLabel } from './format'

it('로컬 날짜를 YYYY.MM.DD로 표시한다', () => {
  expect(formatDate(new Date(2026, 0, 5, 12).toISOString())).toBe('2026.01.05')
  expect(formatDate(new Date(2026, 10, 11, 23, 30).toISOString())).toBe('2026.11.11')
})

it('시간 표시', () => {
  expect(timeLabel({ startTime: '09:00', endTime: '10:30' })).toBe('09:00~10:30')
  expect(timeLabel({ startTime: '09:00', endTime: null })).toBe('09:00')
})
