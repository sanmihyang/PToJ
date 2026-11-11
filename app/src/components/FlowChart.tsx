import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Card } from '../data'
import { buildEdges, layoutCards } from '../lib/layout'
import FlowCard from './FlowCard'

/** 줄 안에서 시작 시간이 가장 늦은 카드가 내려가는 최대 간격 */
const MAX_OFFSET_PX = 40

interface Line {
  key: string
  d: string
  kind: 'vertical' | 'horizontal'
}

interface Props {
  cards: Card[]
  onEdit: (card: Card) => void
}

export default function FlowChart({ cards, onEdit }: Props) {
  const rows = useMemo(() => layoutCards(cards), [cards])
  const edges = useMemo(() => buildEdges(rows), [rows])

  const wrapRef = useRef<HTMLDivElement>(null)
  const cardEls = useRef(new Map<string, HTMLElement>())
  const [lines, setLines] = useState<Line[]>([])

  const measure = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const base = wrap.getBoundingClientRect()
    const rect = (id: string) => {
      const el = cardEls.current.get(id)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        left: r.left - base.left,
        right: r.right - base.left,
        top: r.top - base.top,
        bottom: r.bottom - base.top,
      }
    }
    const next: Line[] = []
    for (const edge of edges) {
      const a = rect(edge.from)
      const b = rect(edge.to)
      if (!a || !b) continue
      let d: string
      if (edge.kind === 'vertical') {
        const x1 = (a.left + a.right) / 2
        const x2 = (b.left + b.right) / 2
        const y1 = a.bottom
        const y2 = b.top
        const ym = (y1 + y2) / 2
        d = `M ${x1} ${y1} C ${x1} ${ym}, ${x2} ${ym}, ${x2} ${y2}`
      } else {
        const y1 = (a.top + a.bottom) / 2
        const y2 = (b.top + b.bottom) / 2
        const xm = (a.right + b.left) / 2
        d = `M ${a.right} ${y1} C ${xm} ${y1}, ${xm} ${y2}, ${b.left} ${y2}`
      }
      next.push({ key: `${edge.kind}:${edge.from}:${edge.to}`, d, kind: edge.kind })
    }
    setLines((prev) =>
      prev.length === next.length && prev.every((l, i) => l.key === next[i].key && l.d === next[i].d)
        ? prev
        : next,
    )
  }, [edges])

  useLayoutEffect(() => {
    measure()
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(measure)
    observer.observe(wrap)
    cardEls.current.forEach((el) => observer.observe(el))
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure, rows])

  return (
    <div className="overflow-x-auto pb-28" data-testid="flow-scroll">
      <div ref={wrapRef} className="relative mx-auto w-max min-w-full px-4 py-4">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {lines.map((line) => (
            <path
              key={line.key}
              d={line.d}
              data-edge={line.kind}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={2}
            />
          ))}
        </svg>
        {rows.map((row, i) => {
          // 같은 열 안에서 카드가 여러 개면(겹침이 이어지는 경우) 열 단위로 쌓는다
          const columns = Array.from({ length: row.columns }, (_, col) =>
            row.cards.filter((p) => p.col === col),
          )
          return (
            <div key={i} data-row={i} className="mb-12 flex justify-center gap-4 last:mb-0">
              {columns.map((col, c) => (
                <div key={c} className="flex flex-col gap-3">
                  {col.map((p, idx) => (
                    <FlowCard
                      key={p.card.id}
                      ref={(el) => {
                        if (el) cardEls.current.set(p.card.id, el)
                        else cardEls.current.delete(p.card.id)
                      }}
                      card={p.card}
                      columns={row.columns}
                      offsetPx={idx === 0 ? Math.round(p.offset * MAX_OFFSET_PX) : 0}
                      onEdit={() => onEdit(p.card)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
