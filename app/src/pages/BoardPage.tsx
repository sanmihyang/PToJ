import { useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import CardFormModal from '../components/CardFormModal'
import FlowChart from '../components/FlowChart'
import LocationModal from '../components/LocationModal'
import { isValidDate, repository, type Card } from '../data'
import { useAppData } from '../hooks/useAppData'
import { todayStr } from '../lib/date'
import { errorMessage } from '../lib/errors'
import {
  VIEW_LABEL,
  VIEW_MODES,
  dayHeading,
  groupByDay,
  isInRange,
  isViewMode,
  periodLabel,
  periodRange,
  shiftPeriod,
  type ViewMode,
} from '../lib/period'

type Dialog =
  | { type: 'create' }
  | { type: 'edit'; card: Card }
  | { type: 'location'; cardId: string }
  | null

const NAV_LABEL: Record<ViewMode, [string, string]> = {
  day: ['이전 날', '다음 날'],
  week: ['이전 주', '다음 주'],
  month: ['이전 달', '다음 달'],
  year: ['이전 해', '다음 해'],
}

const navButton =
  'flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-slate-100'

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

  // 보기(v)와 기준 날짜(d)는 주소에 담아 새로고침/뒤로가기에도 유지한다
  const requestedView = params.get('v')
  const view: ViewMode = isViewMode(requestedView) ? requestedView : 'day'
  const requestedDate = params.get('d')
  const date = requestedDate && isValidDate(requestedDate) ? requestedDate : todayStr()
  const range = periodRange(date, view)

  const go = (nextDate: string, nextView: ViewMode = view) =>
    setParams({ d: nextDate, v: nextView }, { replace: true })

  const groups = groupByDay(board.cards, range)
  const cardCount = groups.reduce((n, g) => n + g.cards.length, 0)
  const crossesYear = range.start.slice(0, 4) !== range.end.slice(0, 4)

  const today = todayStr()
  const defaultDate = view === 'day' ? date : isInRange(today, range) ? today : range.start

  const locationCard =
    dialog?.type === 'location' ? board.cards.find((c) => c.id === dialog.cardId) : undefined
  const openCreate = () => setDialog({ type: 'create' })

  function toggleComplete(card: Card) {
    try {
      repository.updateCard(board!.id, card.id, { isCompleted: !card.isCompleted })
      setActionError(null)
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  const [prevLabel, nextLabel] = NAV_LABEL[view]

  return (
    <main className="mx-auto min-h-dvh max-w-3xl pb-28">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/95 px-2 pb-2 pt-3 backdrop-blur">
        <div className="flex items-center gap-1">
          <Link to="/" aria-label="목록으로" className={navButton}>
            ←
          </Link>
          <h1 className="min-w-0 flex-1 truncate font-bold">{board.name}</h1>
        </div>
        <div className="mt-1 flex items-center justify-center gap-2">
          <button type="button" aria-label={prevLabel} onClick={() => go(shiftPeriod(date, view, -1))} className={navButton}>
            ‹
          </button>
          <span className="min-w-28 text-center text-lg font-semibold" aria-live="polite">
            {periodLabel(date, view)}
          </span>
          <button type="button" aria-label={nextLabel} onClick={() => go(shiftPeriod(date, view, 1))} className={navButton}>
            ›
          </button>
        </div>
        <div role="radiogroup" aria-label="보기 단위" className="mx-auto mt-1 grid max-w-xs grid-cols-4 gap-1 rounded-lg bg-slate-200 p-1">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={view === mode}
              onClick={() => go(date, mode)}
              className={`min-h-9 rounded-md text-sm font-medium ${
                view === mode ? 'bg-white shadow-sm' : 'text-slate-600'
              }`}
            >
              {VIEW_LABEL[mode]}
            </button>
          ))}
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
          {groups.length === 0 ? (
            <p className="mt-16 text-center text-slate-500">
              {view === 'day' ? '이 날짜에 일정이 없습니다' : '이 기간에 일정이 없습니다'}
            </p>
          ) : (
            <>
              {view !== 'day' && (
                <p className="mt-3 text-center text-sm text-slate-500" data-testid="period-summary">
                  {groups.length}일 · 일정 {cardCount}개
                </p>
              )}
              {groups.map((group) => (
                <section key={group.date} data-day={group.date} aria-label={dayHeading(group.date, true)}>
                  {view !== 'day' && (
                    <h2 className="mx-4 mt-6 border-b border-slate-200 pb-1">
                      <button
                        type="button"
                        onClick={() => go(group.date, 'day')}
                        aria-label={`${dayHeading(group.date, true)} 일간 보기`}
                        className="min-h-10 text-base font-bold text-slate-800 hover:underline"
                      >
                        {dayHeading(group.date, crossesYear)}
                      </button>
                    </h2>
                  )}
                  <FlowChart
                    cards={group.cards}
                    onEdit={(card) => setDialog({ type: 'edit', card })}
                    onOpenLocation={(card) => setDialog({ type: 'location', cardId: card.id })}
                    onToggleComplete={toggleComplete}
                  />
                </section>
              ))}
            </>
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
      {(dialog?.type === 'create' || dialog?.type === 'edit') && (
        <CardFormModal
          key={dialog.type === 'edit' ? dialog.card.id : 'new'}
          boardId={board.id}
          card={dialog.type === 'edit' ? dialog.card : undefined}
          defaultDate={defaultDate}
          // 저장한 카드가 지금 보는 기간 밖이면 그 날짜로 이동한다
          onSaved={(savedDate) => {
            if (!isInRange(savedDate, range)) go(savedDate)
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  )
}
