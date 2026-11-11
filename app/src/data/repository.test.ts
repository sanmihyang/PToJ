import { describe, expect, it, vi } from 'vitest'
import { createRepository, ValidationError } from './repository'
import { LocalStorageStore, StorageError } from './storage'
import { FakeStorage, cardInput } from './testUtils'

function setup() {
  const storage = new FakeStorage()
  let n = 0
  let t = Date.parse('2026-01-01T09:00:00Z')
  const make = () =>
    createRepository(new LocalStorageStore(storage, null), {
      newId: () => `id-${++n}`,
      now: () => new Date((t += 60_000)),
    })
  return { storage, repo: make(), make }
}

describe('보드', () => {
  it('생성/이름 변경/삭제', () => {
    const { repo } = setup()
    const b = repo.createBoard('여행')
    expect(repo.getData().boards).toHaveLength(1)
    const renamed = repo.renameBoard(b.id, '제주 여행')
    expect(renamed.name).toBe('제주 여행')
    expect(renamed.updatedAt > b.updatedAt).toBe(true)
    repo.deleteBoard(b.id)
    expect(repo.getData().boards).toHaveLength(0)
  })

  it('잘못된 이름은 거부하고 상태를 바꾸지 않는다', () => {
    const { repo } = setup()
    expect(() => repo.createBoard('')).toThrowError(ValidationError)
    expect(() => repo.createBoard('a'.repeat(31))).toThrowError(ValidationError)
    expect(repo.getData().boards).toHaveLength(0)
  })

  it('없는 보드는 오류', () => {
    const { repo } = setup()
    expect(() => repo.deleteBoard('x')).toThrowError(ValidationError)
    expect(() => repo.renameBoard('x', 'a')).toThrowError(ValidationError)
  })

  it('저장 후 새로 만든 저장소에서도 보인다 (새로고침)', () => {
    const { repo, make } = setup()
    repo.createBoard('여행')
    expect(make().getData().boards.map((b) => b.name)).toEqual(['여행'])
  })
})

describe('보드 복사', () => {
  it('카드는 복사하고 완료 상태는 초기화한다', () => {
    const { repo } = setup()
    const b = repo.createBoard('여행')
    const c = repo.addCard(b.id, cardInput())
    repo.updateCard(b.id, c.id, { isCompleted: true })
    const copy = repo.copyBoard(b.id)
    expect(copy.id).not.toBe(b.id)
    expect(copy.name).toBe('여행 복사')
    expect(copy.cards).toHaveLength(1)
    expect(copy.cards[0].id).not.toBe(c.id)
    expect(copy.cards[0].title).toBe('점심 식사')
    expect(copy.cards[0].isCompleted).toBe(false)
    expect(copy.cards[0].completedAt).toBeNull()
    // 원본은 그대로
    expect(repo.getBoard(b.id)!.cards[0].isCompleted).toBe(true)
  })

  it('이름이 길면 30자 안으로 줄인다', () => {
    const { repo } = setup()
    const b = repo.createBoard('가'.repeat(30))
    const copy = repo.copyBoard(b.id)
    expect(copy.name.length).toBe(30)
    expect(copy.name.endsWith(' 복사')).toBe(true)
  })

  it('없는 보드는 오류', () => {
    const { repo } = setup()
    expect(() => repo.copyBoard('x')).toThrowError(ValidationError)
  })
})

describe('카드', () => {
  it('추가/수정/삭제', () => {
    const { repo } = setup()
    const b = repo.createBoard('여행')
    const c = repo.addCard(b.id, cardInput())
    expect(repo.getBoard(b.id)!.cards).toHaveLength(1)
    expect(c.isCompleted).toBe(false)

    const u = repo.updateCard(b.id, c.id, { title: '저녁 식사', startTime: '18:00' })
    expect(u.title).toBe('저녁 식사')
    expect(u.createdAt).toBe(c.createdAt)

    repo.deleteCard(b.id, c.id)
    expect(repo.getBoard(b.id)!.cards).toHaveLength(0)
  })

  it('입력 검증 실패 시 거부한다', () => {
    const { repo } = setup()
    const b = repo.createBoard('여행')
    expect(() => repo.addCard(b.id, cardInput({ title: '' }))).toThrowError(ValidationError)
    expect(() => repo.addCard(b.id, cardInput({ endTime: '11:00' }))).toThrowError(ValidationError)
    expect(() => repo.addCard(b.id, cardInput({ date: '2026-02-30' }))).toThrowError(ValidationError)
    expect(repo.getBoard(b.id)!.cards).toHaveLength(0)
  })

  it('완료 체크/해제 시 완료 시각이 기록/삭제된다', () => {
    const { repo } = setup()
    const b = repo.createBoard('여행')
    const c = repo.addCard(b.id, cardInput())
    const done = repo.updateCard(b.id, c.id, { isCompleted: true })
    expect(done.isCompleted).toBe(true)
    expect(done.completedAt).not.toBeNull()
    const undone = repo.updateCard(b.id, c.id, { isCompleted: false })
    expect(undone.isCompleted).toBe(false)
    expect(undone.completedAt).toBeNull()
  })

  it('이미 삭제된 카드를 저장하려 하면 오류', () => {
    const { repo } = setup()
    const b = repo.createBoard('여행')
    const c = repo.addCard(b.id, cardInput())
    repo.deleteCard(b.id, c.id)
    expect(() => repo.updateCard(b.id, c.id, { title: 'x' })).toThrowError(ValidationError)
    expect(() => repo.deleteCard(b.id, c.id)).toThrowError(ValidationError)
  })

  it('보드를 삭제하면 카드도 함께 사라진다', () => {
    const { repo, storage } = setup()
    const b = repo.createBoard('여행')
    repo.addCard(b.id, cardInput())
    repo.deleteBoard(b.id)
    expect(storage.getItem('ptoj:data')).not.toContain('점심 식사')
  })
})

describe('저장 실패', () => {
  it('저장에 실패하면 예외를 던지고 메모리 상태를 되돌린다', () => {
    const { repo, storage } = setup()
    const b = repo.createBoard('여행')
    storage.failWrites = 'quota'
    expect(() => repo.addCard(b.id, cardInput())).toThrowError(StorageError)
    expect(repo.getBoard(b.id)!.cards).toHaveLength(0)
    storage.failWrites = null
    repo.addCard(b.id, cardInput())
    expect(repo.getBoard(b.id)!.cards).toHaveLength(1)
  })
})

describe('전체 교체와 구독', () => {
  it('replaceAll은 검증에 실패하면 아무것도 바꾸지 않는다', () => {
    const { repo } = setup()
    repo.createBoard('여행')
    expect(() => repo.replaceAll({ version: 1, boards: [{ id: 'x' }] })).toThrowError(ValidationError)
    expect(repo.getData().boards).toHaveLength(1)
  })

  it('변경 시 구독자에게 알린다', () => {
    const { repo } = setup()
    const listener = vi.fn()
    const off = repo.subscribe(listener)
    repo.createBoard('a')
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    repo.createBoard('b')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('손상된 데이터로 시작하면 initial.status가 recovered', () => {
    const { storage, make } = setup()
    storage.setItem('ptoj:data', 'xxx')
    const repo = make()
    expect(repo.initial.status).toBe('recovered')
    expect(repo.getData().boards).toEqual([])
  })
})

describe('importBoards', () => {
  const sample = (id: string, name: string) => ({
    id,
    name,
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
    cards: [
      {
        id: `${id}-c1`,
        title: '점심',
        content: '',
        date: '2026-01-03',
        startTime: '12:00',
        endTime: null,
        placeName: null,
        address: null,
        isCompleted: true,
        completedAt: '2026-01-03T03:00:00.000Z',
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      },
    ],
  })

  it('새 보드로 추가하고 ID를 새로 발급하며 기존 보드는 그대로 둔다', () => {
    const { repo } = setup()
    const mine = repo.createBoard('내 보드')
    const [added] = repo.importBoards([sample('remote', '받은 보드')])
    expect(repo.getData().boards).toHaveLength(2)
    expect(added.id).not.toBe('remote')
    expect(added.cards[0].id).not.toBe('remote-c1')
    expect(repo.getBoard(mine.id)!.name).toBe('내 보드')
  })

  it('완료 상태와 카드 작성 시각(좌우 배치 기준)은 유지한다', () => {
    const { repo } = setup()
    const [added] = repo.importBoards([sample('remote', '받은 보드')])
    expect(added.cards[0].isCompleted).toBe(true)
    expect(added.cards[0].createdAt).toBe('2020-01-01T00:00:00.000Z')
  })

  it('같은 보드를 두 번 가져와도 ID가 겹치지 않는다', () => {
    const { repo } = setup()
    const b = sample('remote', '받은 보드')
    repo.importBoards([b])
    repo.importBoards([b])
    const ids = repo.getData().boards.map((x) => x.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('여러 보드를 한 번에 추가한다', () => {
    const { repo } = setup()
    repo.importBoards([sample('a', 'A'), sample('b', 'B')])
    expect(repo.getData().boards.map((b) => b.name)).toEqual(['A', 'B'])
  })

  it('저장에 실패하면 아무것도 추가되지 않는다', () => {
    const { repo, storage } = setup()
    storage.failWrites = 'quota'
    expect(() => repo.importBoards([sample('a', 'A')])).toThrowError(StorageError)
    expect(repo.getData().boards).toHaveLength(0)
  })
})
