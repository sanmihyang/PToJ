import { describe, expect, it } from 'vitest'
import type { Attendee } from '../data/types'
import { addAttendee, removeAttendee, setAttendeeStatus, summarize, summaryLabel } from './attendance'

const a = (id: string, name: string, status: Attendee['status'] = 'maybe'): Attendee => ({ id, name, status })

describe('addAttendee', () => {
  it('미정으로 추가하고 이름 앞뒤 공백을 지운다', () => {
    const r = addAttendee([], '  민수  ', 'a1')
    expect(r).toEqual({ ok: true, attendees: [{ id: 'a1', name: '민수', status: 'maybe' }] })
  })
  it('빈 이름/공백뿐인 이름은 거부', () => {
    expect(addAttendee([], '', 'x').ok).toBe(false)
    expect(addAttendee([], '   ', 'x').ok).toBe(false)
  })
  it('20자까지 허용, 초과는 거부', () => {
    expect(addAttendee([], '가'.repeat(20), 'x').ok).toBe(true)
    expect(addAttendee([], '가'.repeat(21), 'x').ok).toBe(false)
  })
  it('중복 이름은 거부 (공백/대소문자 무시)', () => {
    const list = [a('1', 'Minsu')]
    expect(addAttendee(list, 'minsu', 'x')).toEqual({ ok: false, error: '이미 추가된 이름입니다' })
    expect(addAttendee(list, ' MINSU ', 'x').ok).toBe(false)
    expect(addAttendee(list, '영희', 'x').ok).toBe(true)
  })
  it('원본 배열을 바꾸지 않는다', () => {
    const list = [a('1', '민수')]
    addAttendee(list, '영희', '2')
    expect(list).toHaveLength(1)
  })
})

describe('상태 변경/삭제', () => {
  const list = [a('1', '민수'), a('2', '영희')]
  it('해당 참석자의 상태만 바뀐다', () => {
    const next = setAttendeeStatus(list, '2', 'yes')
    expect(next.map((x) => x.status)).toEqual(['maybe', 'yes'])
    expect(list[1].status).toBe('maybe')
  })
  it('삭제', () => {
    expect(removeAttendee(list, '1').map((x) => x.name)).toEqual(['영희'])
    expect(removeAttendee(list, 'zzz')).toHaveLength(2)
  })
})

describe('요약', () => {
  it('상태별 인원', () => {
    const list = [a('1', 'a', 'yes'), a('2', 'b', 'yes'), a('3', 'c', 'no'), a('4', 'd', 'maybe')]
    expect(summarize(list)).toEqual({ yes: 2, no: 1, maybe: 1, total: 4 })
    expect(summaryLabel(list)).toBe('참석 2 · 불참 1 · 미정 1')
  })
  it('참석자가 없으면 추가 유도 문구', () => {
    expect(summaryLabel([])).toBe('참석자 추가')
    expect(summarize([])).toEqual({ yes: 0, no: 0, maybe: 0, total: 0 })
  })
})
