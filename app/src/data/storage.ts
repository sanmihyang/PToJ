import { SCHEMA_VERSION, emptyData, type AppData } from './types'
import { validateAppData } from './validate'

export const DATA_KEY = 'ptoj:data'
export const CORRUPT_KEY = 'ptoj:data:corrupt'

export type StorageErrorReason = 'quota' | 'unavailable'

export class StorageError extends Error {
  reason: StorageErrorReason
  constructor(reason: StorageErrorReason, message: string) {
    super(message)
    this.reason = reason
  }
}

export type LoadStatus = 'ok' | 'empty' | 'recovered'

export interface LoadResult {
  data: AppData
  status: LoadStatus
  /** status가 'recovered'일 때 손상 원인 */
  error?: string
}

/** 화면/저장소 계층은 이 인터페이스만 사용한다. 나중에 IndexedDB 등으로 교체 가능. */
export interface DataStore {
  load(): LoadResult
  save(data: AppData): void
  /** 다른 탭에서 데이터가 바뀌었을 때 호출된다. 해제 함수를 돌려준다. */
  subscribe(listener: () => void): () => void
}

type StorageEventTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014)
  )
}

export class LocalStorageStore implements DataStore {
  private storage: Storage
  private target: StorageEventTarget | null

  constructor(
    storage: Storage = window.localStorage,
    target: StorageEventTarget | null = typeof window === 'undefined' ? null : window,
  ) {
    this.storage = storage
    this.target = target
  }

  load(): LoadResult {
    let raw: string | null
    try {
      raw = this.storage.getItem(DATA_KEY)
    } catch {
      throw new StorageError('unavailable', '저장소를 사용할 수 없습니다')
    }
    if (raw === null) return { data: emptyData(), status: 'empty' }

    let error: string
    try {
      const result = validateAppData(JSON.parse(raw), SCHEMA_VERSION)
      if (result.ok) return { data: result.value, status: 'ok' }
      error = result.error
    } catch {
      error = '저장된 데이터를 읽을 수 없습니다 (JSON 형식 오류)'
    }
    // 손상: 원본을 보관하고 빈 상태로 시작한다. 다음 저장 전까지 원본 키는 건드리지 않는다.
    try {
      this.storage.setItem(CORRUPT_KEY, raw)
    } catch {
      // 보관 실패는 무시한다 (원본 키는 그대로 남아 있다)
    }
    return { data: emptyData(), status: 'recovered', error }
  }

  save(data: AppData): void {
    try {
      this.storage.setItem(DATA_KEY, JSON.stringify(data))
    } catch (e) {
      if (isQuotaError(e)) throw new StorageError('quota', '저장 공간이 부족합니다')
      throw new StorageError('unavailable', '저장할 수 없습니다')
    }
  }

  subscribe(listener: () => void): () => void {
    const target = this.target
    if (!target) return () => {}
    const handler = (e: Event) => {
      const key = (e as StorageEvent).key
      if (key === DATA_KEY || key === null) listener()
    }
    target.addEventListener('storage', handler)
    return () => target.removeEventListener('storage', handler)
  }

  /** 손상 시 보관해 둔 원본 (없으면 null) */
  getCorruptBackup(): string | null {
    try {
      return this.storage.getItem(CORRUPT_KEY)
    } catch {
      return null
    }
  }
}

/** 영구 저장 요청. 지원하지 않으면 null, 허용 여부를 true/false로 돌려준다. */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return null
    return await navigator.storage.persist()
  } catch {
    return null
  }
}

/** localStorage를 쓸 수 없을 때의 대체 저장소. 새로고침하면 사라진다. */
export class MemoryStore implements DataStore {
  private data: AppData = emptyData()
  load(): LoadResult {
    return { data: this.data, status: 'empty' }
  }
  save(data: AppData): void {
    this.data = data
  }
  subscribe(): () => void {
    return () => {}
  }
}
