import type { AppData, Board } from '../data/types'
import { validateBoard } from '../data/validate'

export const APP_ID = 'ptoj'
export const FORMAT_VERSION = 1
/** 가져올 파일/텍스트 최대 크기 */
export const MAX_IMPORT_CHARS = 5_000_000

/** 사용자에게 보여줄 수 있는 가져오기 오류 */
export class ImportError extends Error {}

export type ImportResult =
  | { kind: 'board'; board: Board }
  | { kind: 'backup'; boards: Board[] }

/** JSON 파일 형식 (보드 1개) */
export function boardToFilePayload(board: Board) {
  return { app: APP_ID, version: FORMAT_VERSION, board }
}

/** 전체 백업 형식 */
export function boardsToBackupPayload(data: AppData) {
  return { app: APP_ID, version: FORMAT_VERSION, backup: true, boards: data.boards }
}

/**
 * 링크용 압축 형식: 가져올 때 ID를 새로 발급하므로 ID를 빼고, 비어 있는 값은 생략해 길이를 줄인다.
 * (카드 작성 순서가 좌우 배치에 쓰이므로 createdAt은 유지한다)
 */
export function boardToLinkPayload(board: Board) {
  return {
    app: APP_ID,
    version: FORMAT_VERSION,
    board: {
      name: board.name,
      cards: board.cards.map((c) => ({
        title: c.title,
        ...(c.content ? { content: c.content } : {}),
        date: c.date,
        startTime: c.startTime,
        ...(c.endTime ? { endTime: c.endTime } : {}),
        ...(c.placeName ? { placeName: c.placeName } : {}),
        ...(c.address ? { address: c.address } : {}),
        ...(c.isCompleted ? { isCompleted: true, completedAt: c.completedAt } : {}),
        createdAt: c.createdAt,
      })),
    },
  }
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** 압축 형식에서 생략된 값(ID, 수정 시각, 빈 값)을 채운 뒤 검증한다 */
function normalizeBoard(raw: unknown, now: string): unknown {
  if (!isObj(raw)) return raw
  const cards = Array.isArray(raw.cards)
    ? raw.cards.map((c, i) =>
        isObj(c)
          ? {
              id: `card-${i}`,
              content: '',
              isCompleted: false,
              completedAt: null,
              updatedAt: c.createdAt,
              ...c,
            }
          : c,
      )
    : raw.cards
  return { id: 'board', createdAt: now, updatedAt: now, ...raw, cards }
}

function checkedBoard(raw: unknown, now: string): Board {
  const result = validateBoard(normalizeBoard(raw, now))
  if (!result.ok) throw new ImportError(`보드 데이터 형식이 올바르지 않습니다 (${result.error})`)
  return result.value
}

/** JSON 텍스트(파일/링크 내용)를 해석한다. 실패하면 ImportError. */
export function parseImport(text: string, now: string = new Date().toISOString()): ImportResult {
  if (text.length > MAX_IMPORT_CHARS) throw new ImportError('파일이 너무 큽니다')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ImportError('JSON 형식이 아닙니다')
  }
  if (!isObj(data) || data.app !== APP_ID) {
    throw new ImportError('이 앱에서 만든 파일이 아닙니다')
  }
  if (data.version !== FORMAT_VERSION) {
    throw new ImportError(`지원하지 않는 버전입니다 (파일 버전 ${String(data.version)})`)
  }
  if (data.backup === true) {
    if (!Array.isArray(data.boards)) throw new ImportError('백업 파일 형식이 올바르지 않습니다')
    const boards = data.boards.map((b) => checkedBoard(b, now))
    return { kind: 'backup', boards }
  }
  if (data.board === undefined) throw new ImportError('보드 데이터가 없습니다')
  return { kind: 'board', board: checkedBoard(data.board, now) }
}
