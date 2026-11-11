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

  it('참석 기능을 꺼도 참석자는 보관된다', () => {
    const { repo } = setup()
    const b = repo.createBoard('여행')
    const c = repo.addCard(b.id, cardInput({ attendanceEnabled: true }))
    repo.updateCard(b.id, c.id, { attendees: [{ id: 'a1', name: '민수', status: 'yes' }] })
    const off = repo.updateCard(b.id, c.id, { attendanceEnabled: false })
    expect(off.attendees).toHaveLength(1)
    const on = repo.updateCard(b.id, c.id, { attendanceEnabled: true })
    expect(on.attendees[0].name).toBe('민수')
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
