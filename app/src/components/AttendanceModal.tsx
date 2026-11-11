import { useState, type FormEvent } from 'react'
import { LIMITS, repository, type Attendee, type AttendeeStatus, type Card } from '../data'
import {
  STATUS_LABEL,
  STATUS_ORDER,
  addAttendee,
  removeAttendee,
  setAttendeeStatus,
  summarize,
} from '../lib/attendance'
import { errorMessage } from '../lib/errors'
import Modal from './Modal'

interface Props {
  boardId: string
  card: Card
  onClose: () => void
}

const TONE: Record<AttendeeStatus, string> = {
  yes: 'border-emerald-600 bg-emerald-600 text-white',
  no: 'border-rose-500 bg-rose-500 text-white',
  maybe: 'border-slate-500 bg-slate-500 text-white',
}

/** 참석자 이름을 직접 추가하고 참석/불참/미정을 고른다. 변경은 바로 저장된다. */
export default function AttendanceModal({ boardId, card, onClose }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const summary = summarize(card.attendees)

  function save(next: Attendee[]) {
    try {
      repository.updateCard(boardId, card.id, { attendees: next })
      setError(null)
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    }
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    const result = addAttendee(card.attendees, name, crypto.randomUUID())
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (save(result.attendees)) setName('')
  }

  return (
    <Modal title="참석자" onClose={onClose}>
      <p className="mb-1 truncate text-sm text-slate-500">{card.title}</p>
      <p className="mb-4 text-sm font-medium" aria-live="polite">
        참석 {summary.yes}명 · 불참 {summary.no}명 · 미정 {summary.maybe}명
      </p>

      {card.attendees.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">아직 참석자가 없습니다. 이름을 추가해 보세요.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-3">
          {card.attendees.map((a) => (
            <li key={a.id} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium">{a.name}</span>
                <button
                  type="button"
                  aria-label={`${a.name} 삭제`}
                  onClick={() => save(removeAttendee(card.attendees, a.id))}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
              <div role="radiogroup" aria-label={`${a.name} 참석 여부`} className="grid grid-cols-3 gap-2">
                {STATUS_ORDER.map((status) => {
                  const selected = a.status === status
                  return (
                    <button
                      key={status}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => save(setAttendeeStatus(card.attendees, a.id, status))}
                      className={`min-h-11 rounded-lg border-2 text-sm font-medium ${
                        selected ? TONE[status] : 'border-slate-300 bg-white text-slate-600'
                      }`}
                    >
                      {STATUS_LABEL[status]}
                    </button>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={name}
          maxLength={LIMITS.attendeeName}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          aria-label="참석자 이름"
          placeholder="이름 입력"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
        <button type="submit" className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white">
          추가
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-slate-600">
          닫기
        </button>
      </div>
    </Modal>
  )
}
