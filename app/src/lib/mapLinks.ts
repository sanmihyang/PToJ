export interface MapLink {
  id: 'kakao' | 'naver' | 'google'
  label: string
  url: string
}

interface Place {
  placeName: string | null
  address: string | null
}

/** 장소명과 주소를 합친 검색어 (둘 다 없으면 빈 문자열) */
export function searchQuery(place: Place): string {
  return [place.placeName, place.address]
    .map((v) => v?.trim() ?? '')
    .filter((v) => v.length > 0)
    .join(' ')
}

export function hasPlace(place: Place): boolean {
  return searchQuery(place).length > 0
}

/** 지도 앱/웹 검색 링크. 위치가 없으면 빈 배열. API 키는 필요 없다. */
export function mapLinks(place: Place): MapLink[] {
  const query = searchQuery(place)
  if (!query) return []
  const q = encodeURIComponent(query)
  return [
    { id: 'kakao', label: '카카오맵', url: `https://map.kakao.com/link/search/${q}` },
    { id: 'naver', label: '네이버지도', url: `https://map.naver.com/p/search/${q}` },
    { id: 'google', label: '구글지도', url: `https://www.google.com/maps/search/?api=1&query=${q}` },
  ]
}
