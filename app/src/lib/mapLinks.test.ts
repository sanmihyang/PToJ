import { describe, expect, it } from 'vitest'
import { hasPlace, mapLinks, searchQuery } from './mapLinks'

const url = (links: ReturnType<typeof mapLinks>, id: string) => links.find((l) => l.id === id)!.url

describe('searchQuery', () => {
  it('장소명과 주소를 공백으로 합친다', () => {
    expect(searchQuery({ placeName: '카페 모닝', address: '서울 강남구 테헤란로 1' })).toBe(
      '카페 모닝 서울 강남구 테헤란로 1',
    )
  })
  it('한쪽만 있어도 된다', () => {
    expect(searchQuery({ placeName: '카페', address: null })).toBe('카페')
    expect(searchQuery({ placeName: null, address: '서울 강남구' })).toBe('서울 강남구')
  })
  it('둘 다 없거나 공백뿐이면 빈 문자열', () => {
    expect(searchQuery({ placeName: null, address: null })).toBe('')
    expect(searchQuery({ placeName: '  ', address: '' })).toBe('')
    expect(hasPlace({ placeName: '  ', address: null })).toBe(false)
    expect(hasPlace({ placeName: '카페', address: null })).toBe(true)
  })
})

describe('mapLinks', () => {
  it('위치가 없으면 링크가 없다', () => {
    expect(mapLinks({ placeName: null, address: null })).toEqual([])
  })

  it('한글과 공백을 인코딩한다', () => {
    const links = mapLinks({ placeName: '제주 공항', address: null })
    expect(url(links, 'kakao')).toBe(`https://map.kakao.com/link/search/${encodeURIComponent('제주 공항')}`)
    expect(url(links, 'naver')).toBe(`https://map.naver.com/p/search/${encodeURIComponent('제주 공항')}`)
    expect(url(links, 'google')).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('제주 공항')}`,
    )
    expect(url(links, 'kakao')).toContain('%EC%A0%9C%EC%A3%BC%20%EA%B3%B5%ED%95%AD')
  })

  it('특수문자(& # ? / %)가 주소 구조를 깨뜨리지 않는다', () => {
    const links = mapLinks({ placeName: 'A&B #1?', address: '1/2 100%' })
    for (const l of links) {
      const u = new URL(l.url)
      expect(u.hash).toBe('')
    }
    const google = new URL(url(links, 'google'))
    expect(google.searchParams.get('query')).toBe('A&B #1? 1/2 100%')
    expect(url(links, 'kakao')).not.toMatch(/\/link\/search\/.*[/?#&].*$/)
    expect(decodeURIComponent(url(links, 'naver').split('/search/')[1])).toBe('A&B #1? 1/2 100%')
  })

  it('세 가지 지도를 같은 순서로 돌려준다', () => {
    expect(mapLinks({ placeName: '카페', address: null }).map((l) => l.label)).toEqual([
      '카카오맵',
      '네이버지도',
      '구글지도',
    ])
  })
})
