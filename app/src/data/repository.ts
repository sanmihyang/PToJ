import { LIMITS, SCHEMA_VERSION, type AppData, type Board, type Card } from './types'
import type { DataStore, LoadResult } from './storage'
import { validateAppData } from './validate'

export class ValidationError extends Error {}

/** 보드/카드가 없거나 이미 삭제된 경우 */
export class NotFoundError extends ValidationError {}

export interface CardInput {
  title: string
  content: string
  date: string
  startTime: string
  endTime: string | null
  placeName: string | null
  address: string | null
}

export interface CardPatch extends Partial<CardInput> {
  isCompleted?: boolean
}

export interface Repository {
  /** 최초 로드 결과 (복구 여부 안내용) */
  readonly initial: LoadResult
  getData(): AppData
  getBoard(id: string): Board | undefined
  createBoard(name: string): Board
  renameBoard(id: string, name: string): Board
  deleteBoard(id: string): void
  /** 카드를 복사한 새 보드를 만든다. 완료 상태는 초기화한다. */
  copyBoard(id: string): Board
  addCard(boardId: string, input: CardInput): Card
  updateCard(boardId: string, cardId: string, patch: CardPatch): Card
  deleteCard(boardId: string, cardId: string): void
  /** 보드들을 새 보드로 추가한다 (보드/카드 ID를 새로 발급, 기존 보드는 그대로). 추가된 보드를 돌려준다. */
  importBoards(boards: Board[]): Board[]
  /** 전체 데이터를 교체한다 (복원/가져오기용). 검증에 실패하면 ValidationError. */
  replaceAll(data: unknown): void
  /** 변경(이 탭 또는 다른 탭)이 있을 때 호출된다. 해제 함수를 돌려준다. */
  subscribe(listener: () => void): () => void
}

export interface RepositoryOptions {
  now?: () => Date
  newId?: () => string
}

export function createRepository(store: DataStore, options: RepositoryOptions = {}): Repository {
  const now = options.now ?? (() => new Date())
  const newId = options.newId ?? (() => crypto.randomUUID())

  const initial = store.load()
  let data = initial.data
  const listeners = new Set<() => void>()

  const emit = () => listeners.forEach((l) => l())

  /** 새 데이터를 검증하고 저장한다. 저장에 실패하면 메모리 상태는 그대로 두고 예외를 던진다. */
  function commit(next: AppData) {
    const result = validateAppData(next, SCHEMA_VERSION)
    if (!result.ok) throw new ValidationError(result.error)
    store.save(result.value)
    data = result.value
    emit()
  }

  function boardOrThrow(id: string): Board {
    const board = data.boards.find((b) => b.id === id)
    if (!board) throw new NotFoundError('존재하지 않는 보드입니다')
    return board
  }

  function withBoard(id: string, update: (board: Board, ts: string) => Board): Board {
    boardOrThrow(id)
    const ts = now().toISOString()
    let result!: Board
    commit({
      ...data,
      boards: data.boards.map((b) => {
        if (b.id !== id) return b
        result = { ...update(b, ts), updatedAt: ts }
        return result
      }),
    })
    return data.boards.find((b) => b.id === id) ?? result
  }

  store.subscribe(() => {
    const loaded = store.load()
    if (loaded.status === 'ok' || loaded.status === 'empty') {
      data = loaded.data
      emit()
    }
  })

  return {
    initial,
    getData: () => data,
    getBoard: (id) => data.boards.find((b) => b.id === id),

    createBoard(name) {
      const ts = now().toISOString()
      const board: Board = { id: newId(), name, createdAt: ts, updatedAt: ts, cards: [] }
      commit({ ...data, boards: [...data.boards, board] })
      return board
    },

    renameBoard: (id, name) => withBoard(id, (b) => ({ ...b, name })),

    deleteBoard(id) {
      boardOrThrow(id)
      commit({ ...data, boards: data.boards.filter((b) => b.id !== id) })
    },

    copyBoard(id) {
      const source = boardOrThrow(id)
      const ts = now().toISOString()
      const suffix = ' 복사'
      const name =
        source.name.length + suffix.length > LIMITS.boardName
          ? source.name.slice(0, LIMITS.boardName - suffix.length) + suffix
          : source.name + suffix
      const board: Board = {
        id: newId(),
        name,
        createdAt: ts,
        updatedAt: ts,
        cards: source.cards.map((c) => ({
          ...c,
          id: newId(),
          isCompleted: false,
          completedAt: null,
        })),
      }
      commit({ ...data, boards: [...data.boards, board] })
      return board
    },

    addCard(boardId, input) {
      const ts = now().toISOString()
      const card: Card = {
        ...input,
        id: newId(),
        isCompleted: false,
        completedAt: null,
        createdAt: ts,
        updatedAt: ts,
      }
      withBoard(boardId, (b) => ({ ...b, cards: [...b.cards, card] }))
      return card
    },

    updateCard(boardId, cardId, patch) {
      const board = boardOrThrow(boardId)
      if (!board.cards.some((c) => c.id === cardId)) {
        throw new NotFoundError('이미 삭제된 일정입니다')
      }
      let updated!: Card
      withBoard(boardId, (b, ts) => ({
        ...b,
        cards: b.cards.map((c) => {
          if (c.id !== cardId) return c
          const { isCompleted, ...rest } = patch
          const next: Card = { ...c, ...stripUndefined(rest), updatedAt: ts }
          if (isCompleted !== undefined && isCompleted !== c.isCompleted) {
            next.isCompleted = isCompleted
            next.completedAt = isCompleted ? ts : null
          }
          updated = next
          return next
        }),
      }))
      return updated
    },

    deleteCard(boardId, cardId) {
      const board = boardOrThrow(boardId)
      if (!board.cards.some((c) => c.id === cardId)) {
        throw new NotFoundError('이미 삭제된 일정입니다')
      }
      withBoard(boardId, (b) => ({ ...b, cards: b.cards.filter((c) => c.id !== cardId) }))
    },

    importBoards(boards) {
      const ts = now().toISOString()
      const added: Board[] = boards.map((b) => ({
        ...b,
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        cards: b.cards.map((c) => ({ ...c, id: newId() })),
      }))
      commit({ ...data, boards: [...data.boards, ...added] })
      return added
    },

    replaceAll(value) {
      const result = validateAppData(value, SCHEMA_VERSION)
      if (!result.ok) throw new ValidationError(result.error)
      commit(result.value)
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
