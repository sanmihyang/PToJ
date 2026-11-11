import { forwardRef } from 'react'
import type { Card } from '../data'
import { timeLabel } from '../lib/format'

interface Props {
  card: Card
  /** 같은 줄의 열 수. 2열 이상이면 카드를 좁게 그린다 */
  columns: number
  /** 줄 안에서 아래로 내릴 간격(px) */
  offsetPx: number
  onEdit: () => void
}

const FlowCard = forwardRef<HTMLDivElement, Props>(function FlowCard(
  { card, columns, offsetPx, onEdit },
  ref,
) {
  const width = columns > 1 ? 'w-40' : 'w-[min(15rem,calc(100vw-2rem))]'
  return (
    <div
      ref={ref}
      data-card-id={card.id}
      style={{ marginTop: offsetPx }}
      className={`relative z-10 ${width} shrink-0 rounded-xl border-2 border-slate-300 bg-white p-3 shadow-sm`}
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
    </div>
  )
})

export default FlowCard
