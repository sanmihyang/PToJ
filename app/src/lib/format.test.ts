import { expect, it } from 'vitest'
import { formatDate } from './format'

it('로컬 날짜를 YYYY.MM.DD로 표시한다', () => {
  expect(formatDate(new Date(2026, 0, 5, 12).toISOString())).toBe('2026.01.05')
  expect(formatDate(new Date(2026, 10, 11, 23, 30).toISOString())).toBe('2026.11.11')
})
