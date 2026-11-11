import { describe, expect, it, vi } from 'vitest'
import { CORRUPT_KEY, DATA_KEY, LocalStorageStore, StorageError } from './storage'
import { SCHEMA_VERSION, emptyData } from './types'
import { FakeStorage } from './testUtils'

function setup() {
  const storage = new FakeStorage()
  const store = new LocalStorageStore(storage, null)
  return { storage, store }
}

describe('LocalStorageStore', () => {
  it('저장된 것이 없으면 빈 데이터로 시작한다', () => {
    const { store } = setup()
    const r = store.load()
    expect(r.status).toBe('empty')
    expect(r.data).toEqual(emptyData())
  })

  it('저장 후 다시 읽으면 같은 데이터가 나온다', () => {
    const { storage, store } = setup()
    const data = {
      version: SCHEMA_VERSION,
      boards: [{ id: 'b', name: '보드', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', cards: [] }],
    }
    store.save(data)
    expect(storage.getItem(DATA_KEY)).toBe(JSON.stringify(data))
    const r = new LocalStorageStore(storage, null).load()
    expect(r.status).toBe('ok')
    expect(r.data).toEqual(data)
  })

  it('JSON이 깨졌으면 원본을 보관하고 빈 데이터로 시작한다', () => {
    const { storage, store } = setup()
    storage.setItem(DATA_KEY, '{깨진 json')
    const r = store.load()
    expect(r.status).toBe('recovered')
    expect(r.data).toEqual(emptyData())
    expect(storage.getItem(CORRUPT_KEY)).toBe('{깨진 json')
    expect(storage.getItem(DATA_KEY)).toBe('{깨진 json') // 저장 전까지 원본 유지
    expect(store.getCorruptBackup()).toBe('{깨진 json')
  })

  it('형식이 맞지 않는 데이터도 복구 처리한다', () => {
    const { storage, store } = setup()
    storage.setItem(DATA_KEY, JSON.stringify({ version: 1, boards: [{ id: 'x' }] }))
    const r = store.load()
    expect(r.status).toBe('recovered')
    expect(r.error).toBeTruthy()
  })

  it('용량 초과 시 StorageError(quota)', () => {
    const { storage, store } = setup()
    storage.failWrites = 'quota'
    expect(() => store.save(emptyData())).toThrowError(StorageError)
    try {
      store.save(emptyData())
    } catch (e) {
      expect((e as StorageError).reason).toBe('quota')
    }
  })

  it('쓰기가 차단되면 StorageError(unavailable)', () => {
    const { storage, store } = setup()
    storage.failWrites = 'other'
    try {
      store.save(emptyData())
      expect.unreachable()
    } catch (e) {
      expect((e as StorageError).reason).toBe('unavailable')
    }
  })

  it('다른 탭의 변경(storage 이벤트)을 알려준다', () => {
    const storage = new FakeStorage()
    const handlers = new Set<(e: Event) => void>()
    const target = {
      addEventListener: (_: string, h: (e: Event) => void) => void handlers.add(h),
      removeEventListener: (_: string, h: (e: Event) => void) => void handlers.delete(h),
    }
    const store = new LocalStorageStore(storage, target as never)
    const listener = vi.fn()
    const off = store.subscribe(listener)
    const fire = (key: string | null) => handlers.forEach((h) => h({ key } as unknown as Event))

    fire('다른키')
    expect(listener).not.toHaveBeenCalled()
    fire(DATA_KEY)
    expect(listener).toHaveBeenCalledTimes(1)
    fire(null) // clear()
    expect(listener).toHaveBeenCalledTimes(2)
    off()
    fire(DATA_KEY)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
