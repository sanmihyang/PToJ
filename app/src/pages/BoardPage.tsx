import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import AttendanceModal from '../components/AttendanceModal'
import CardFormModal from '../components/CardFormModal'
import FlowChart from '../components/FlowChart'
import LocationModal from '../components/LocationModal'
import { isValidDate, repository, type Card } from '../data'
import { useAppData } from '../hooks/useAppData'
import { addDays, formatDay, todayStr } from '../lib/date'
import { errorMessage } from '../lib/errors'

type Dialog =
  | { type: 'create' }
  | { type: 'edit'; card: Card }
  | { type: 'location'; cardId: string }
  | { type: 'attendance'; cardId: string }
  | null

export default function BoardPage() {
  const { id } = useParams()
  const { boards } = useAppData()
  const [params, setParams] = useSearchParams()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const board = boards.find((b) => b.id === id)
  if (!board) {
    return <Navigate to="/" replace state={{ notice: '존재하지 않는 보드입니다' }} />
  }

  const requested = params.get('d')
  const date = requested && isValidDate(requested) ? requested : todayStr()
  const goTo = (next: string) => setParams({ d: next }, { replace: true })

  const dayCards = board.cards.filter((c) => c.date === date)
  const locationCard =
    dialog?.type === 'location' ? board.cards.find((c) => c.id === dialog.cardId) : undefined
  const attendanceCard =
    dialog?.type === 'attendance' ? board.cards.find((c) => c.id === dialog.cardId) : undefined
  const openCreate = () => setDialog({ type: 'create' })

  function toggleComplete(card: Card) {
    try {
      repository.updateCard(board!.id, card.id, { isCompleted: !card.isCompleted })
      setActionError(null)
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-3xl">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/95 px-2 pb-2 pt-3 backdrop-blur">
        <div className="flex items-center gap-1">
          <Link
            to="/"
            aria-label="목록으로"
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-slate-100"
          >
            ←
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-bold">{board.name}</h1>
        </div>
        <div className="mt-1 flex items-center justify-center gap-2">
          <button
            type="button"
            aria-label="이전 날"
            onClick={() => goTo(addDays(date, -1))}
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-slate-100"
          >
            ‹
          </button>
          <span className="min-w-28 text-center text-lg font-semibold" aria-live="polite">
            {formatDay(date)}
          </span>
          <button
            type="button"
            aria-label="다음 날"
            onClick={() => goTo(addDays(date, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-slate-100"
          >
            ›
          </button>
        </div>
      </header>

      {actionError && (
        <p role="alert" className="mx-4 mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {board.cards.length === 0 ? (
        <div className="flex min-h-[60dvh] items-center justify-center">
          <button
            type="button"
            aria-label="일정 추가"
            onClick={openCreate}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 text-4xl text-white shadow-lg"
          >
            +
          </button>
        </div>
      ) : (
        <>
          {dayCards.length === 0 ? (
            <p className="mt-16 text-center text-slate-500">이 날짜에 일정이 없습니다</p>
          ) : (
            <FlowChart
              cards={dayCards}
              onEdit={(card) => setDialog({ type: 'edit', card })}
              onOpenLocation={(card) => setDialog({ type: 'location', cardId: card.id })}
              onOpenAttendance={(card) => setDialog({ type: 'attendance', cardId: card.id })}
              onToggleComplete={toggleComplete}
            />
          )}
          <button
            type="button"
            aria-label="일정 추가"
            onClick={openCreate}
            className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-3xl text-white shadow-lg"
          >
            +
          </button>
        </>
      )}

      {dialog?.type === 'location' && locationCard && (
        <LocationModal card={locationCard} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === 'attendance' && attendanceCard && (
        <AttendanceModal boardId={board.id} card={attendanceCard} onClose={() => setDialog(null)} />
      )}
      {(dialog?.type === 'create' || dialog?.type === 'edit') && (
        <CardFormModal
          key={dialog.type === 'edit' ? dialog.card.id : 'new'}
          boardId={board.id}
          card={dialog.type === 'edit' ? dialog.card : undefined}
          defaultDate={date}
          onSaved={goTo}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  )
}
