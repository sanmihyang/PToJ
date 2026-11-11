import { forwardRef } from 'react'
import type { Card } from '../data'
import { timeLabel } from '../lib/format'
import { summaryLabel } from '../lib/attendance'
import { hasPlace } from '../lib/mapLinks'

interface Props {
  card: Card
  /** 같은 줄의 열 수. 2열 이상이면 카드를 좁게 그린다 */
  columns: number
  /** 줄 안에서 아래로 내릴 간격(px) */
  offsetPx: number
  onEdit: () => void
  onOpenLocation: () => void
  onOpenAttendance: () => void
  onToggleComplete: () => void
}

const FlowCard = forwardRef<HTMLDivElement, Props>(function FlowCard(
  { card, columns, offsetPx, onEdit, onOpenLocation, onOpenAttendance, onToggleComplete },
  ref,
) {
  const width = columns > 1 ? 'w-40' : 'w-[min(15rem,calc(100vw-2rem))]'
  const tone = card.isCompleted
    ? 'border-emerald-500 bg-emerald-50'
    : 'border-slate-300 bg-white'
  return (
    <div
      ref={ref}
      data-card-id={card.id}
      data-completed={card.isCompleted}
      style={{ marginTop: offsetPx }}
      className={`relative z-10 ${width} shrink-0 rounded-xl border-2 p-3 shadow-sm transition-colors ${tone}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{timeLabel(card)}</p>
          <p className="mt-0.5 break-words font-semibold leading-snug">{card.title}</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`${card.title} 수정`}
          className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          ✎
        </button>
      </div>
      {card.content && (
        <p className="mt-1 line-clamp-2 break-words text-sm text-slate-600">{card.content}</p>
      )}
      {hasPlace(card) && (
        <button
          type="button"
          onClick={onOpenLocation}
          aria-label={`${card.title} 위치 보기`}
          className="-mx-1 mt-1 flex min-h-9 w-full items-center gap-1 rounded-lg px-1 text-left text-sm text-sky-700 hover:bg-black/5"
        >
          <span aria-hidden="true">📍</span>
          <span className="min-w-0 truncate">{card.placeName ?? card.address}</span>
        </button>
      )}
      {card.attendanceEnabled && (
        <button
          type="button"
          onClick={onOpenAttendance}
          aria-label={`${card.title} 참석자 관리`}
          className="-mx-1 mt-1 flex min-h-9 w-full items-center gap-1 rounded-lg px-1 text-left text-sm text-violet-700 hover:bg-black/5"
        >
          <span aria-hidden="true">👥</span>
          <span className="min-w-0 truncate">{summaryLabel(card.attendees)}</span>
        </button>
      )}
      <button
        type="button"
        role="checkbox"
        aria-checked={card.isCompleted}
        aria-label={`${card.title} 완료`}
        onClick={onToggleComplete}
        className="-mx-1 mt-2 flex min-h-10 w-full items-center gap-2 rounded-lg px-1 text-sm text-slate-600 hover:bg-black/5"
      >
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-sm font-bold ${
            card.isCompleted
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-slate-400 bg-white text-transparent'
          }`}
        >
          ✓
        </span>
        <span className={card.isCompleted ? 'font-medium text-emerald-700' : ''}>
          {card.isCompleted ? '완료' : '완료 체크'}
        </span>
      </button>
    </div>
  )
})

export default FlowCard
