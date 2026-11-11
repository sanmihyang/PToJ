import { describe, expect, it } from 'vitest'
import { validateCardForm, type CardFormValues } from './cardForm'

const ok: CardFormValues = {
  title: '점심',
  date: '2026-01-03',
  startTime: '12:00',
  endTime: '',
  content: '',
  placeName: '',
  address: '',
}

describe('validateCardForm', () => {
  it('올바른 입력', () => {
    expect(validateCardForm(ok)).toEqual({})
    expect(validateCardForm({ ...ok, endTime: '13:00' })).toEqual({})
  })
  it('제목이 비어 있거나 공백뿐이면 오류', () => {
    expect(validateCardForm({ ...ok, title: '' }).title).toBeTruthy()
    expect(validateCardForm({ ...ok, title: '   ' }).title).toBeTruthy()
  })
  it('날짜/시작 시간은 필수', () => {
    expect(validateCardForm({ ...ok, date: '' }).date).toBeTruthy()
    expect(validateCardForm({ ...ok, startTime: '' }).startTime).toBeTruthy()
  })
  it('종료 시간은 시작보다 늦어야 한다 (같아도 오류)', () => {
    expect(validateCardForm({ ...ok, endTime: '12:00' }).endTime).toBeTruthy()
    expect(validateCardForm({ ...ok, endTime: '11:00' }).endTime).toBeTruthy()
  })
})
