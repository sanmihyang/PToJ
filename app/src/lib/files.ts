/** 파일 이름에 쓸 수 없는 문자를 바꾼다 */
export function sanitizeFileName(name: string, fallback = 'ptoj'): string {
  const cleaned = [...name]
    .filter((ch) => ch.charCodeAt(0) >= 32) // 제어 문자 제거
    .join('')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
  return cleaned.length > 0 && cleaned !== '.' && cleaned !== '..' ? cleaned : fallback
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 일부 브라우저는 클릭 직후 해제하면 저장이 취소된다
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare && navigator.canShare({ files })
  } catch {
    return false
  }
}

export function canShareText(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/** 기기 공유 시트로 보낸다. 사용자가 취소하면 'cancelled'. */
export async function shareViaSheet(data: ShareData): Promise<'shared' | 'cancelled'> {
  try {
    await navigator.share(data)
    return 'shared'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    throw e
  }
}

/** 클립보드 복사. API가 막힌 환경에서는 예전 방식으로 한 번 더 시도한다. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      area.remove()
    }
  }
}

export function dateStamp(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
}
