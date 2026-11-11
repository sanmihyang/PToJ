// 데이터 모델: doc/data/schema.json 참고

export const SCHEMA_VERSION = 1

export const LIMITS = {
  boardName: 30,
  cardTitle: 50,
  cardContent: 500,
  attendeeName: 20,
  placeName: 200,
  address: 300,
} as const

export type AttendeeStatus = 'yes' | 'no' | 'maybe'

export interface Attendee {
  id: string
  name: string
  status: AttendeeStatus
}

export interface Card {
  id: string
  title: string
  content: string
  /** YYYY-MM-DD */
  date: string
  /** HH:mm */
  startTime: string
  /** HH:mm, 있으면 startTime보다 늦어야 함 */
  endTime: string | null
  placeName: string | null
  address: string | null
  isCompleted: boolean
  completedAt: string | null
  attendanceEnabled: boolean
  /** attendanceEnabled가 false여도 보관한다 */
  attendees: Attendee[]
  createdAt: string
  updatedAt: string
}

export interface Board {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  cards: Card[]
}

export interface AppData {
  version: number
  boards: Board[]
}

export function emptyData(): AppData {
  return { version: SCHEMA_VERSION, boards: [] }
}
