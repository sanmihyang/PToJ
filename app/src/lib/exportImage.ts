import { toBlob } from 'html-to-image'

/** 캔버스 한계(특히 iOS Safari)를 넘지 않도록 잡은 최대 픽셀 수 */
export const MAX_PIXELS = 12_000_000
export const MIN_PIXEL_RATIO = 0.5

/** 이미지 크기에 맞는 배율(최대 2배). 너무 커서 저장할 수 없으면 null */
export function pickPixelRatio(width: number, height: number): number | null {
  if (width <= 0 || height <= 0) return null
  const ratio = Math.min(2, Math.sqrt(MAX_PIXELS / (width * height)))
  return ratio < MIN_PIXEL_RATIO ? null : ratio
}

export class ImageTooLargeError extends Error {}

/**
 * 화면의 로드맵을 PNG로 만든다. 가로 스크롤로 잘린 부분까지 담기 위해
 * 캡처하는 동안 node에 data-exporting을 붙이고 (CSS가 overflow를 풀어 준다) 끝나면 뗀다.
 */
export async function exportNodeToPng(node: HTMLElement): Promise<Blob> {
  node.setAttribute('data-exporting', 'true')
  try {
    // 스타일 적용 후 레이아웃이 안정되길 기다린다
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const width = node.scrollWidth
    const height = node.scrollHeight
    const ratio = pickPixelRatio(width, height)
    if (ratio === null) throw new ImageTooLargeError('이미지가 너무 큽니다')
    const blob = await toBlob(node, {
      width,
      height,
      pixelRatio: ratio,
      backgroundColor: '#f8fafc',
      filter: (el) => !(el instanceof HTMLElement && el.hasAttribute('data-export-ignore')),
    })
    if (!blob) throw new Error('이미지를 만들지 못했습니다')
    return blob
  } finally {
    node.removeAttribute('data-exporting')
  }
}
