import { describe, expect, it } from 'vitest'
import { pickPixelRatio, MAX_PIXELS } from './exportImage'
import { dateStamp, sanitizeFileName } from './files'

describe('sanitizeFileName', () => {
  it('금지 문자를 바꾼다', () => {
    expect(sanitizeFileName('제주/여행: 1일차?')).toBe('제주_여행_ 1일차_')
    expect(sanitizeFileName('a\\b*c"d<e>f|g')).toBe('a_b_c_d_e_f_g')
  })
  it('비었거나 점뿐이면 기본 이름', () => {
    expect(sanitizeFileName('')).toBe('ptoj')
    expect(sanitizeFileName('   ')).toBe('ptoj')
    expect(sanitizeFileName('..')).toBe('ptoj')
    expect(sanitizeFileName('', 'x')).toBe('x')
  })
  it('60자로 줄인다', () => {
    expect(sanitizeFileName('가'.repeat(100))).toHaveLength(60)
  })
})

it('날짜 도장', () => {
  expect(dateStamp(new Date(2026, 0, 5))).toBe('20260105')
  expect(dateStamp(new Date(2026, 10, 11))).toBe('20261111')
})

describe('pickPixelRatio', () => {
  it('작은 이미지는 2배', () => {
    expect(pickPixelRatio(400, 800)).toBe(2)
  })
  it('커지면 배율을 낮춰 최대 픽셀 수를 넘지 않게 한다', () => {
    const r = pickPixelRatio(800, 6000)!
    expect(r).toBeLessThan(2)
    expect(800 * r * (6000 * r)).toBeLessThanOrEqual(MAX_PIXELS + 1)
  })
  it('너무 크면 null', () => {
    expect(pickPixelRatio(800, 100000)).toBeNull()
  })
  it('잘못된 크기는 null', () => {
    expect(pickPixelRatio(0, 100)).toBeNull()
    expect(pickPixelRatio(100, -1)).toBeNull()
  })
})
