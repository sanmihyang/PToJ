import { createRepository } from './repository'
import { LocalStorageStore, MemoryStore, StorageError, type DataStore } from './storage'

export * from './types'
export { StorageError, requestPersistence, DATA_KEY, CORRUPT_KEY } from './storage'
export { ValidationError, type CardInput, type CardPatch, type Repository } from './repository'
export { validateAppData, validateBoard, isValidDate, isValidTime } from './validate'

function createStore(): { store: DataStore; persistent: boolean; local: LocalStorageStore | null } {
  try {
    const local = new LocalStorageStore()
    local.load() // 접근 가능한지 확인
    return { store: local, persistent: true, local }
  } catch (e) {
    if (!(e instanceof StorageError) && !(e instanceof DOMException)) throw e
    return { store: new MemoryStore(), persistent: false, local: null }
  }
}

const created = createStore()

/** 앱 전체에서 공유하는 저장소 인스턴스 */
export const repository = createRepository(created.store)

/** false이면 저장소를 쓸 수 없어 이번 접속 동안만 데이터가 유지된다 */
export const isPersistent = created.persistent

/** 데이터가 손상되어 빈 상태로 시작한 경우 보관된 원본 */
export function getCorruptBackup(): string | null {
  return created.local?.getCorruptBackup() ?? null
}
