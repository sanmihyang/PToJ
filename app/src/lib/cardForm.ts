import { isValidDate, isValidTime } from '../data/validate'

export interface CardFormValues {
  title: string
  date: string
  startTime: string
  endTime: string
  content: string
  placeName: string
  address: string
}

export type CardFormErrors = Partial<Record<keyof CardFormValues, string>>

export function validateCardForm(v: CardFormValues): CardFormErrors {
  const errors: CardFormErrors = {}
  if (v.title.trim().length === 0) errors.title = '제목을 입력해 주세요'
  if (!isValidDate(v.date)) errors.date = '날짜를 입력해 주세요'
  if (!isValidTime(v.startTime)) {
    errors.startTime = '시작 시간을 입력해 주세요'
  } else if (v.endTime !== '') {
    if (!isValidTime(v.endTime)) errors.endTime = '종료 시간 형식이 올바르지 않습니다'
    else if (v.endTime <= v.startTime) {
      errors.endTime = '종료 시간은 시작 시간보다 늦어야 합니다 (자정을 넘기는 일정은 지원하지 않습니다)'
    }
  }
  return errors
}
