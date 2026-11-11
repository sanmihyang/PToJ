import type { CardInput } from './repository'

/** 테스트용 localStorage 대체 */
export class FakeStorage implements Storage {
  private map = new Map<string, string>()
  failWrites: 'quota' | 'other' | null = null

  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    if (this.failWrites === 'quota') throw new DOMException('full', 'QuotaExceededError')
    if (this.failWrites === 'other') throw new DOMException('denied', 'SecurityError')
    this.map.set(key, value)
  }
}

export function cardInput(overrides: Partial<CardInput> = {}): CardInput {
  return {
    title: '점심 식사',
    content: '',
    date: '2026-01-03',
    startTime: '12:00',
    endTime: null,
    placeName: null,
    address: null,
    attendanceEnabled: false,
    ...overrides,
  }
}
