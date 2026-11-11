/** 모바일 기기 여부 (스마트폰/태블릿). 내비 앱 링크는 모바일에서만 의미가 있다. */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true
  // iPadOS는 데스크톱 Safari로 위장한다
  return /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1
}
