import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Card } from '../data'
import { buildEdges, layoutCards, styleEdges } from '../lib/layout'
import FlowCard from './FlowCard'

/** 줄 안에서 시작 시간이 가장 늦은 카드가 내려가는 최대 간격 */
const MAX_OFFSET_PX = 40

interface Line {
  key: string
  d: string
  kind: 'vertical' | 'horizontal'
  highlighted: boolean
}

const PLAIN_COLOR = '#94a3b8'
const PROGRESS_COLOR = '#059669'

interface Props {
  cards: Card[]
  onEdit: (card: Card) => void
  onToggleComplete: (card: Card) => void
}

export default function FlowChart({ cards, onEdit, onToggleComplete }: Props) {
  const rows = useMemo(() => layoutCards(cards), [cards])
  const edges = useMemo(() => styleEdges(buildEdges(rows), cards), [rows, cards])

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
        const y2 = b.top - 1
        const ym = (y1 + y2) / 2
        d = `M ${x1} ${y1} C ${x1} ${ym}, ${x2} ${ym}, ${x2} ${y2}`
      } else {
        const y1 = (a.top + a.bottom) / 2
        const y2 = (b.top + b.bottom) / 2
        const xm = (a.right + b.left) / 2
        d = `M ${a.right} ${y1} C ${xm} ${y1}, ${xm} ${y2}, ${b.left} ${y2}`
      }
      next.push({
        key: `${edge.kind}:${edge.from}:${edge.to}`,
        d,
        kind: edge.kind,
        highlighted: edge.highlighted,
      })
    }
    setLines((prev) =>
      prev.length === next.length && prev.every(
        (l, i) => l.key === next[i].key && l.d === next[i].d && l.highlighted === next[i].highlighted,
      )
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
          <defs>
            <marker
              id="progress-arrow"
              viewBox="0 0 12 12"
              refX="11"
              refY="6"
              markerWidth="12"
              markerHeight="12"
              markerUnits="userSpaceOnUse"
              orient="auto"
            >
              <path d="M0,0 L12,6 L0,12 Z" fill={PROGRESS_COLOR} />
            </marker>
          </defs>
          {/* 강조된 선이 위에 보이도록 기본 선을 먼저 그린다 */}
          {[...lines]
            .sort((a, b) => Number(a.highlighted) - Number(b.highlighted))
            .map((line) => {
              const arrow = line.highlighted && line.kind === 'vertical'
              return (
                <path
                  key={line.key}
                  d={line.d}
                  data-edge={line.kind}
                  data-edge-state={line.highlighted ? 'progress' : 'plain'}
                  fill="none"
                  stroke={line.highlighted ? PROGRESS_COLOR : PLAIN_COLOR}
                  strokeWidth={arrow ? 4 : line.highlighted ? 3 : 2}
                  markerEnd={arrow ? 'url(#progress-arrow)' : undefined}
                />
              )
            })}
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
                      onToggleComplete={() => onToggleComplete(p.card)}
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
