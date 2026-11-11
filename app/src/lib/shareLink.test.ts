import { describe, expect, it } from 'vitest'
import type { Board, Card } from '../data/types'
import { ImportError } from './shareFormat'
import { MAX_LINK_LENGTH, boardFromToken, buildShareLink, tokenFromText } from './shareLink'
import { encodeToken } from './compress'

const ts = '2026-01-01T09:00:00.000Z'
const ORIGIN = 'https://sanmihyang.github.io'
const BASE = '/PToJ/'

function card(i: number, o: Partial<Card> = {}): Card {
  return {
    id: crypto.randomUUID(),
    title: `일정 ${i}`,
    content: i % 2 ? '메모를 조금 적어 둔 내용입니다' : '',
    date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    startTime: `${String(8 + (i % 12)).padStart(2, '0')}:00`,
    endTime: i % 3 === 0 ? `${String(9 + (i % 12)).padStart(2, '0')}:30` : null,
    placeName: i % 2 ? '카페 모닝' : null,
    address: i % 2 ? '서울 강남구 테헤란로 123' : null,
    isCompleted: i % 5 === 0,
    completedAt: i % 5 === 0 ? ts : null,
    createdAt: new Date(Date.parse(ts) + i * 60000).toISOString(),
    updatedAt: ts,
    ...o,
  }
}

function board(n: number): Board {
  return { id: crypto.randomUUID(), name: '제주 여행', createdAt: ts, updatedAt: ts, cards: Array.from({ length: n }, (_, i) => card(i + 1)) }
}

describe('공유 링크', () => {
  it('주소 형식과 왕복', async () => {
    const link = await buildShareLink(board(3), ORIGIN, BASE)
    expect(link.url.startsWith(`${ORIGIN}${BASE}#/import?d=`)).toBe(true)
    expect(link.length).toBe(link.url.length)
    const token = tokenFromText(link.url)!
    const got = await boardFromToken(token)
    expect(got.name).toBe('제주 여행')
    expect(got.cards).toHaveLength(3)
    expect(got.cards[0].title).toBe('일정 1')
  })

  // 제목/메모/장소를 모두 채운 카드(압축이 잘 안 되는 실제 사용에 가까운 경우)
  const rand = () => Math.random().toString(36).slice(2, 10)
  const varied = (n: number): Board => ({
    ...board(0),
    cards: Array.from({ length: n }, (_, i) =>
      card(i + 1, { title: `일정 ${rand()}`, content: `메모 ${rand()}${rand()} 내용`, placeName: `장소 ${rand()}`, address: `서울 ${rand()}로 ${i}` }),
    ),
  })

  it('카드가 적으면 한계 안에 들어온다', async () => {
    expect((await buildShareLink(varied(10), ORIGIN, BASE)).tooLong).toBe(false)
  })

  it('내용을 모두 채운 카드 100개까지는 한계 안에 들어온다', async () => {
    const link = await buildShareLink(varied(100), ORIGIN, BASE)
    expect(link.tooLong).toBe(false)
    expect(link.length).toBeLessThan(MAX_LINK_LENGTH)
  })

  it('카드가 아주 많으면 너무 길다고 알려 준다', async () => {
    const link = await buildShareLink(varied(300), ORIGIN, BASE)
    expect(link.tooLong).toBe(true)
    expect(link.length).toBeGreaterThan(MAX_LINK_LENGTH)
  })

  it('링크 토큰 추출: 전체 링크 / 일부 / 앞뒤 공백', () => {
    expect(tokenFromText('https://x.io/PToJ/#/import?d=abc_DEF-123')).toBe('abc_DEF-123')
    expect(tokenFromText('  #/import?d=abc  ')).toBe('abc')
    expect(tokenFromText('d=abc')).toBeNull() // 앞에 ? & # 가 없으면 링크로 보지 않는다
    expect(tokenFromText('안녕하세요')).toBeNull()
  })

  it('깨진 토큰은 ImportError', async () => {
    await expect(boardFromToken('abc')).rejects.toBeInstanceOf(ImportError)
    await expect(boardFromToken('%%%')).rejects.toBeInstanceOf(ImportError)
  })

  it('압축은 올바르지만 내용이 이 앱의 보드가 아니면 ImportError', async () => {
    const token = await encodeToken(JSON.stringify({ hello: 'world' }))
    await expect(boardFromToken(token)).rejects.toBeInstanceOf(ImportError)
    const backup = await encodeToken(JSON.stringify({ app: 'ptoj', version: 1, backup: true, boards: [] }))
    await expect(boardFromToken(backup)).rejects.toThrowError('보드 링크가 아닙니다')
  })
})
