import { isMobileDevice } from './device'

export interface MapLink {
  id: 'kakao' | 'naver' | 'google' | 'tmap'
  label: string
  url: string
  /** 앱 실행용 주소(웹 페이지가 아님). 같은 창에서 연다 */
  appScheme?: boolean
}

interface Place {
  placeName: string | null
  address: string | null
}

/**
 * 지도 검색어. 주소가 있으면 주소로만 검색한다 (장소명은 같은 이름의 다른 장소가 나올 수 있어서).
 * 주소가 없을 때만 장소명으로 검색한다.
 */
export function searchQuery(place: Place): string {
  const address = place.address?.trim() ?? ''
  if (address) return address
  return place.placeName?.trim() ?? ''
}

export function hasPlace(place: Place): boolean {
  return searchQuery(place).length > 0
}

/**
 * 지도 앱/웹 검색 링크. 위치가 없으면 빈 배열. API 키는 필요 없다.
 * 티맵은 앱 실행 주소라 모바일에서만 돌려준다. (카카오내비는 URL 방식을 공식 지원하지 않아 제외)
 */
export function mapLinks(place: Place, mobile: boolean = isMobileDevice()): MapLink[] {
  const query = searchQuery(place)
  if (!query) return []
  const q = encodeURIComponent(query)
  const links: MapLink[] = [
    { id: 'kakao', label: '카카오맵', url: `https://map.kakao.com/link/search/${q}` },
    { id: 'naver', label: '네이버지도', url: `https://map.naver.com/p/search/${q}` },
    { id: 'google', label: '구글지도', url: `https://www.google.com/maps/search/?api=1&query=${q}` },
  ]
  if (mobile) {
    links.push({ id: 'tmap', label: '티맵', url: `tmap://search?name=${q}`, appScheme: true })
  }
  return links
}
