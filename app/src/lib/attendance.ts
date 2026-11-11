import { LIMITS, type Attendee, type AttendeeStatus } from '../data/types'

export const STATUS_LABEL: Record<AttendeeStatus, string> = {
  yes: '참석',
  no: '불참',
  maybe: '미정',
}

export const STATUS_ORDER: AttendeeStatus[] = ['yes', 'no', 'maybe']

export type AddResult = { ok: true; attendees: Attendee[] } | { ok: false; error: string }

/** 이름 비교용 (앞뒤 공백/대소문자 무시) */
const normalize = (name: string) => name.trim().toLowerCase()

/** 새 참석자는 '미정'으로 추가한다. 빈 이름, 너무 긴 이름, 중복 이름은 거부한다. */
export function addAttendee(list: Attendee[], rawName: string, id: string): AddResult {
  const name = rawName.trim()
  if (name.length === 0) return { ok: false, error: '이름을 입력해 주세요' }
  if (name.length > LIMITS.attendeeName) {
    return { ok: false, error: `이름은 ${LIMITS.attendeeName}자 이하로 입력해 주세요` }
  }
  if (list.some((a) => normalize(a.name) === normalize(name))) {
    return { ok: false, error: '이미 추가된 이름입니다' }
  }
  return { ok: true, attendees: [...list, { id, name, status: 'maybe' }] }
}

export function setAttendeeStatus(list: Attendee[], id: string, status: AttendeeStatus): Attendee[] {
  return list.map((a) => (a.id === id ? { ...a, status } : a))
}

export function removeAttendee(list: Attendee[], id: string): Attendee[] {
  return list.filter((a) => a.id !== id)
}

export function summarize(list: Attendee[]) {
  const count = { yes: 0, no: 0, maybe: 0, total: list.length }
  for (const a of list) count[a.status]++
  return count
}

/** 카드에 표시하는 요약. 참석자가 없으면 추가를 유도하는 문구 */
export function summaryLabel(list: Attendee[]): string {
  if (list.length === 0) return '참석자 추가'
  const c = summarize(list)
  return `참석 ${c.yes} · 불참 ${c.no} · 미정 ${c.maybe}`
}
