import { addDays } from './date'

export type ViewMode = 'day' | 'week' | 'month' | 'year'

export const VIEW_MODES: ViewMode[] = ['day', 'week', 'month', 'year']

export const VIEW_LABEL: Record<ViewMode, string> = {
  day: '일',
  week: '주',
  month: '월',
  year: '연',
}

export function isViewMode(value: string | null): value is ViewMode {
  return value !== null && (VIEW_MODES as string[]).includes(value)
}

export interface Range {
  /** 포함, YYYY-MM-DD */
  start: string
  /** 포함, YYYY-MM-DD */
  end: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

/** 0=일 ... 6=토 */
function dayOfWeek(date: string): number {
  const [y, m, d] = parts(date)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** 그 날이 속한 주의 월요일 (주는 월~일) */
export function weekStart(date: string): string {
  const offset = (dayOfWeek(date) + 6) % 7 // 월=0 ... 일=6
  return addDays(date, -offset)
}

export function periodRange(date: string, view: ViewMode): Range {
  const [y, m] = parts(date)
  switch (view) {
    case 'day':
      return { start: date, end: date }
    case 'week': {
      const start = weekStart(date)
      return { start, end: addDays(start, 6) }
    }
    case 'month':
      return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(daysInMonth(y, m))}` }
    case 'year':
      return { start: `${y}-01-01`, end: `${y}-12-31` }
  }
}

/** 이전(-1)/다음(+1) 기간으로 이동. 월/연 이동은 말일을 넘지 않게 맞춘다 (1/31 → 2/28) */
export function shiftPeriod(date: string, view: ViewMode, direction: -1 | 1): string {
  const [y, m, d] = parts(date)
  switch (view) {
    case 'day':
      return addDays(date, direction)
    case 'week':
      return addDays(date, 7 * direction)
    case 'month': {
      const index = y * 12 + (m - 1) + direction
      const ny = Math.floor(index / 12)
      const nm = (index % 12) + 1
      return `${ny}-${pad(nm)}-${pad(Math.min(d, daysInMonth(ny, nm)))}`
    }
    case 'year': {
      const ny = y + direction
      return `${ny}-${pad(m)}-${pad(Math.min(d, daysInMonth(ny, m)))}`
    }
  }
}

/** 헤더에 표시하는 기간 이름 */
export function periodLabel(date: string, view: ViewMode): string {
  const [y, m] = parts(date)
  switch (view) {
    case 'day':
      return date.replaceAll('-', '.')
    case 'week': {
      const { start, end } = periodRange(date, 'week')
      const s = start.replaceAll('-', '.')
      const e = end.replaceAll('-', '.')
      return `${s} ~ ${start.slice(0, 4) === end.slice(0, 4) ? e.slice(5) : e}`
    }
    case 'month':
      return `${y}.${pad(m)}`
    case 'year':
      return String(y)
  }
}

/** 02.15 (일) 형태의 날짜 제목 */
export function dayHeading(date: string, withYear: boolean): string {
  const [y, m, d] = parts(date)
  return `${withYear ? `${y}.` : ''}${pad(m)}.${pad(d)} (${WEEKDAYS[dayOfWeek(date)]})`
}

export interface DayGroup<T> {
  date: string
  cards: T[]
}

/** 기간 안의 카드를 날짜별로 묶는다. 카드가 있는 날만, 날짜순으로 돌려준다. */
export function groupByDay<T extends { date: string }>(cards: T[], range: Range): DayGroup<T>[] {
  const byDate = new Map<string, T[]>()
  for (const card of cards) {
    if (card.date < range.start || card.date > range.end) continue
    const list = byDate.get(card.date)
    if (list) list.push(card)
    else byDate.set(card.date, [card])
  }
  return [...byDate.keys()].sort().map((date) => ({ date, cards: byDate.get(date)! }))
}

export function isInRange(date: string, range: Range): boolean {
  return date >= range.start && date <= range.end
}
