import {
  LIMITS,
  type AppData,
  type Attendee,
  type AttendeeStatus,
  type Board,
  type Card,
} from './types'

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

class InvalidError extends Error {}

type Obj = Record<string, unknown>

function fail(path: string, message: string): never {
  throw new InvalidError(`${path}: ${message}`)
}

function obj(value: unknown, path: string): Obj {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, '객체여야 합니다')
  }
  return value as Obj
}

function str(o: Obj, key: string, path: string, max: number, required = false): string {
  const v = o[key]
  if (typeof v !== 'string') fail(`${path}.${key}`, '문자열이어야 합니다')
  if (v.length > max) fail(`${path}.${key}`, `${max}자 이하여야 합니다`)
  if (required && v.trim().length === 0) fail(`${path}.${key}`, '비어 있을 수 없습니다')
  return v
}

function nullableStr(o: Obj, key: string, path: string, max: number): string | null {
  const v = o[key]
  if (v === null || v === undefined) return null
  return str(o, key, path, max)
}

function bool(o: Obj, key: string, path: string): boolean {
  const v = o[key]
  if (typeof v !== 'boolean') fail(`${path}.${key}`, 'true/false여야 합니다')
  return v
}

export function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
  )
}

export function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
}

function isValidDateTime(s: string): boolean {
  return Number.isFinite(Date.parse(s))
}

function dateField(o: Obj, key: string, path: string): string {
  const v = str(o, key, path, 10)
  if (!isValidDate(v)) fail(`${path}.${key}`, 'YYYY-MM-DD 형식의 올바른 날짜여야 합니다')
  return v
}

function timeField(o: Obj, key: string, path: string): string {
  const v = str(o, key, path, 5)
  if (!isValidTime(v)) fail(`${path}.${key}`, 'HH:mm 형식이어야 합니다')
  return v
}

function dateTimeField(o: Obj, key: string, path: string): string {
  const v = str(o, key, path, 40)
  if (!isValidDateTime(v)) fail(`${path}.${key}`, '올바른 날짜/시각이어야 합니다')
  return v
}

function array(o: Obj, key: string, path: string): unknown[] {
  const v = o[key]
  if (!Array.isArray(v)) fail(`${path}.${key}`, '배열이어야 합니다')
  return v
}

function uniqueIds(items: { id: string }[], path: string) {
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id)) fail(path, `id가 중복되었습니다 (${item.id})`)
    seen.add(item.id)
  }
}

function parseAttendee(value: unknown, path: string): Attendee {
  const o = obj(value, path)
  const status = o.status
  if (status !== 'yes' && status !== 'no' && status !== 'maybe') {
    fail(`${path}.status`, "'yes' | 'no' | 'maybe' 중 하나여야 합니다")
  }
  return {
    id: str(o, 'id', path, 100, true),
    name: str(o, 'name', path, LIMITS.attendeeName, true),
    status: status as AttendeeStatus,
  }
}

function parseCard(value: unknown, path: string): Card {
  const o = obj(value, path)
  const startTime = timeField(o, 'startTime', path)
  const rawEnd = nullableStr(o, 'endTime', path, 5)
  let endTime: string | null = null
  if (rawEnd !== null) {
    if (!isValidTime(rawEnd)) fail(`${path}.endTime`, 'HH:mm 형식이어야 합니다')
    if (rawEnd <= startTime) fail(`${path}.endTime`, '시작 시간보다 늦어야 합니다')
    endTime = rawEnd
  }
  const isCompleted = bool(o, 'isCompleted', path)
  const completedAtRaw = o.completedAt
  let completedAt: string | null = null
  if (isCompleted) {
    completedAt = dateTimeField(o, 'completedAt', path)
  } else if (completedAtRaw !== null && completedAtRaw !== undefined) {
    fail(`${path}.completedAt`, '완료하지 않은 카드는 null이어야 합니다')
  }
  const attendees = array(o, 'attendees', path).map((a, i) =>
    parseAttendee(a, `${path}.attendees[${i}]`),
  )
  uniqueIds(attendees, `${path}.attendees`)
  return {
    id: str(o, 'id', path, 100, true),
    title: str(o, 'title', path, LIMITS.cardTitle, true),
    content: str(o, 'content', path, LIMITS.cardContent),
    date: dateField(o, 'date', path),
    startTime,
    endTime,
    placeName: nullableStr(o, 'placeName', path, 200),
    address: nullableStr(o, 'address', path, 300),
    isCompleted,
    completedAt,
    attendanceEnabled: bool(o, 'attendanceEnabled', path),
    attendees,
    createdAt: dateTimeField(o, 'createdAt', path),
    updatedAt: dateTimeField(o, 'updatedAt', path),
  }
}

function parseBoard(value: unknown, path: string): Board {
  const o = obj(value, path)
  const cards = array(o, 'cards', path).map((c, i) => parseCard(c, `${path}.cards[${i}]`))
  uniqueIds(cards, `${path}.cards`)
  return {
    id: str(o, 'id', path, 100, true),
    name: str(o, 'name', path, LIMITS.boardName, true),
    createdAt: dateTimeField(o, 'createdAt', path),
    updatedAt: dateTimeField(o, 'updatedAt', path),
    cards,
  }
}

function wrap<T>(fn: () => T): Result<T> {
  try {
    return { ok: true, value: fn() }
  } catch (e) {
    if (e instanceof InvalidError) return { ok: false, error: e.message }
    throw e
  }
}

/** 알 수 없는 필드는 제거한 새 객체를 돌려준다. */
export function validateBoard(value: unknown): Result<Board> {
  return wrap(() => parseBoard(value, 'board'))
}

export function validateAppData(value: unknown, supportedVersion: number): Result<AppData> {
  return wrap(() => {
    const o = obj(value, 'data')
    const version = o.version
    if (typeof version !== 'number') fail('data.version', '숫자여야 합니다')
    if (version !== supportedVersion) {
      fail('data.version', `지원하지 않는 버전입니다 (${version})`)
    }
    const boards = array(o, 'boards', 'data').map((b, i) => parseBoard(b, `data.boards[${i}]`))
    uniqueIds(boards, 'data.boards')
    return { version, boards }
  })
}
