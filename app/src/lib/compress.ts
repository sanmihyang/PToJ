/** 공유 링크용 압축: JSON 문자열 ↔ deflate-raw + base64url 토큰 */

export class ShareError extends Error {}

/** 압축 해제 후 최대 크기 (악의적으로 부풀린 링크 방지) */
export const MAX_DECODED_BYTES = 2_000_000
/** 입력 토큰 최대 길이 */
export const MAX_TOKEN_LENGTH = 400_000

export function supportsCompression(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'
}

async function readAll(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > limit) {
      await reader.cancel()
      throw new ShareError('데이터가 너무 큽니다')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(token: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(token)) throw new ShareError('링크 형식이 올바르지 않습니다')
  const padded = token.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (token.length % 4)) % 4)
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    throw new ShareError('링크 형식이 올바르지 않습니다')
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function encodeToken(text: string): Promise<string> {
  if (!supportsCompression()) throw new ShareError('이 브라우저는 링크 공유를 지원하지 않습니다')
  const input = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return toBase64Url(await readAll(input, MAX_DECODED_BYTES))
}

export async function decodeToken(token: string): Promise<string> {
  if (!supportsCompression()) throw new ShareError('이 브라우저는 링크 공유를 지원하지 않습니다')
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    throw new ShareError('링크 형식이 올바르지 않습니다')
  }
  const bytes = fromBase64Url(token)
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    const out = await readAll(stream, MAX_DECODED_BYTES)
    return new TextDecoder('utf-8', { fatal: true }).decode(out)
  } catch (e) {
    if (e instanceof ShareError) throw e
    throw new ShareError('링크 내용을 읽을 수 없습니다')
  }
}
