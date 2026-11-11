import { decodeToken, encodeToken, ShareError } from './compress'
import { boardToLinkPayload, ImportError, parseImport } from './shareFormat'
import type { Board } from '../data/types'

/** 메신저/브라우저에서 안전하게 다룰 수 있는 링크 길이(보수적으로 잡은 값) */
export const MAX_LINK_LENGTH = 8000

export interface ShareLink {
  url: string
  length: number
  tooLong: boolean
}

export async function buildShareLink(
  board: Board,
  origin: string = window.location.origin,
  base: string = import.meta.env.BASE_URL,
): Promise<ShareLink> {
  const token = await encodeToken(JSON.stringify(boardToLinkPayload(board)))
  const url = `${origin}${base}#/import?d=${token}`
  return { url, length: url.length, tooLong: url.length > MAX_LINK_LENGTH }
}

/** 링크의 토큰(d 값)에서 보드를 꺼낸다. 실패하면 사용자에게 보여줄 수 있는 오류. */
export async function boardFromToken(token: string): Promise<Board> {
  let text: string
  try {
    text = await decodeToken(token)
  } catch (e) {
    throw new ImportError(e instanceof ShareError ? e.message : '링크 내용을 읽을 수 없습니다')
  }
  const result = parseImport(text)
  if (result.kind !== 'board') throw new ImportError('보드 링크가 아닙니다')
  return result.board
}

/** 사용자가 붙여넣은 텍스트에서 링크 토큰을 찾는다 (링크 전체 또는 d=... 부분) */
export function tokenFromText(text: string): string | null {
  const match = /[?&#]d=([A-Za-z0-9_-]+)/.exec(text.trim())
  return match ? match[1] : null
}
