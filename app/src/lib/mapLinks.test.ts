import { describe, expect, it } from 'vitest'
import { hasPlace, mapLinks, searchQuery } from './mapLinks'

const url = (links: ReturnType<typeof mapLinks>, id: string) => links.find((l) => l.id === id)!.url

describe('searchQuery (주소 우선)', () => {
  it('주소가 있으면 주소로만 검색한다 (장소명은 쓰지 않는다)', () => {
    expect(searchQuery({ placeName: '카페 모닝', address: '서울 강남구 테헤란로 1' })).toBe(
      '서울 강남구 테헤란로 1',
    )
  })
  it('주소가 없으면 장소명으로 검색한다', () => {
    expect(searchQuery({ placeName: '카페', address: null })).toBe('카페')
    expect(searchQuery({ placeName: '카페', address: '   ' })).toBe('카페')
  })
  it('주소만 있어도 된다', () => {
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
  const place = { placeName: '카페 모닝', address: '서울 강남구 테헤란로 1' }

  it('위치가 없으면 링크가 없다', () => {
    expect(mapLinks({ placeName: null, address: null }, true)).toEqual([])
  })

  it('주소를 한글/공백까지 인코딩해 검색 링크를 만든다', () => {
    const links = mapLinks(place, false)
    const q = encodeURIComponent('서울 강남구 테헤란로 1')
    expect(url(links, 'kakao')).toBe(`https://map.kakao.com/link/search/${q}`)
    expect(url(links, 'naver')).toBe(`https://map.naver.com/p/search/${q}`)
    expect(url(links, 'google')).toBe(`https://www.google.com/maps/search/?api=1&query=${q}`)
    expect(url(links, 'kakao')).not.toContain(encodeURIComponent('카페'))
  })

  it('특수문자(& # ? / %)가 주소 구조를 깨뜨리지 않는다', () => {
    const links = mapLinks({ placeName: null, address: 'A&B #1? 1/2 100%' }, true)
    for (const l of links) expect(l.url).not.toMatch(/#/)
    const google = new URL(url(links, 'google'))
    expect(google.searchParams.get('query')).toBe('A&B #1? 1/2 100%')
    expect(decodeURIComponent(url(links, 'naver').split('/search/')[1])).toBe('A&B #1? 1/2 100%')
    expect(decodeURIComponent(url(links, 'tmap').split('name=')[1])).toBe('A&B #1? 1/2 100%')
  })

  it('티맵은 모바일에서만 포함되고 앱 실행 주소다', () => {
    expect(mapLinks(place, false).map((l) => l.id)).toEqual(['kakao', 'naver', 'google'])
    const mobile = mapLinks(place, true)
    expect(mobile.map((l) => l.label)).toEqual(['카카오맵', '네이버지도', '구글지도', '티맵'])
    const tmap = mobile.find((l) => l.id === 'tmap')!
    expect(tmap.url).toBe(`tmap://search?name=${encodeURIComponent('서울 강남구 테헤란로 1')}`)
    expect(tmap.appScheme).toBe(true)
    expect(mobile.filter((l) => l.appScheme)).toHaveLength(1)
  })

  it('카카오내비 링크는 만들지 않는다 (URL 방식 미지원)', () => {
    expect(mapLinks(place, true).some((l) => /navi|내비/i.test(l.id + l.label))).toBe(false)
  })
})
