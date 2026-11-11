import { describe, expect, it } from 'vitest'
import { MAX_DECODED_BYTES, ShareError, decodeToken, encodeToken, supportsCompression } from './compress'

describe('압축 토큰', () => {
  it('이 환경은 압축 스트림을 지원한다', () => {
    expect(supportsCompression()).toBe(true)
  })

  it('한글/이모지/긴 텍스트가 왕복해도 같다', async () => {
    for (const text of ['', 'a', '제주 여행 📍 흑돼지 맛집', JSON.stringify({ a: '가'.repeat(5000) })]) {
      if (text === '') continue
      expect(await decodeToken(await encodeToken(text))).toBe(text)
    }
  })

  it('URL에 안전한 문자만 쓴다 (+ / = 없음)', async () => {
    const token = await encodeToken(JSON.stringify({ x: Array.from({ length: 300 }, (_, i) => i * 7919) }))
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('반복이 많은 데이터는 훨씬 짧아진다', async () => {
    const text = JSON.stringify(Array.from({ length: 50 }, () => ({ title: '점심 식사', date: '2026-01-03' })))
    expect((await encodeToken(text)).length).toBeLessThan(text.length / 3)
  })

  it('잘못된 토큰은 ShareError', async () => {
    await expect(decodeToken('')).rejects.toBeInstanceOf(ShareError)
    await expect(decodeToken('!!!')).rejects.toBeInstanceOf(ShareError)
    await expect(decodeToken('abcdefg')).rejects.toBeInstanceOf(ShareError) // 올바른 압축 데이터가 아님
    await expect(decodeToken('A'.repeat(400_001))).rejects.toBeInstanceOf(ShareError)
  })

  it('중간이 잘린 토큰은 거부한다', async () => {
    const token = await encodeToken(JSON.stringify({ a: '가나다라마바사'.repeat(200) }))
    await expect(decodeToken(token.slice(0, Math.floor(token.length / 2)))).rejects.toBeInstanceOf(ShareError)
  })

  it('압축 해제 결과가 너무 커지면 거부한다 (부풀린 링크)', async () => {
    const huge = 'a'.repeat(MAX_DECODED_BYTES + 1000)
    const stream = new Blob([huge]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    const token = btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
    expect(token.length).toBeLessThan(10_000) // 작은 토큰이 큰 데이터로 풀린다
    await expect(decodeToken(token)).rejects.toBeInstanceOf(ShareError)
  })
})
