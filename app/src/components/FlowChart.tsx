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
  onOpenLocation: (card: Card) => void
  onOpenAttendance: (card: Card) => void
  onToggleComplete: (card: Card) => void
}

export default function FlowChart({ cards, onEdit, onOpenLocation, onOpenAttendance, onToggleComplete }: Props) {
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
    // 줄 사이에서 모든 연결선이 같은 높이에서 꺾이도록 줄 사이 중간 높이를 구한다
    const rowOf = new Map<string, number>()
    rows.forEach((row, i) => row.cards.forEach((p) => rowOf.set(p.card.id, i)))
    const gapY: number[] = []
    for (let r = 0; r < rows.length - 1; r++) {
      const bottoms = rows[r].cards.map((p) => rect(p.card.id)?.bottom ?? 0)
      const tops = rows[r + 1].cards.map((p) => rect(p.card.id)?.top ?? 0)
      gapY[r] = (Math.max(...bottoms) + Math.min(...tops)) / 2
    }

    const next: Line[] = []
    for (const edge of edges) {
      const a = rect(edge.from)
      const b = rect(edge.to)
      if (!a || !b) continue
      let d: string
      if (edge.kind === 'vertical') {
        // 아래로 → 옆으로 → 아래로 (직각 꺾은선). 위치가 같으면 곧은 직선
        const x1 = Math.round((a.left + a.right) / 2)
        const x2 = Math.round((b.left + b.right) / 2)
        const ym = Math.round(gapY[rowOf.get(edge.from) ?? 0])
        const y2 = Math.round(b.top) - 1
        d = `M ${x1} ${Math.round(a.bottom)} L ${x1} ${ym} L ${x2} ${ym} L ${x2} ${y2}`
      } else {
        // 옆으로 → 위/아래로 → 옆으로
        const y1 = Math.round((a.top + a.bottom) / 2)
        const y2 = Math.round((b.top + b.bottom) / 2)
        const xm = Math.round((a.right + b.left) / 2)
        d = `M ${Math.round(a.right)} ${y1} L ${xm} ${y1} L ${xm} ${y2} L ${Math.round(b.left)} ${y2}`
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
  }, [edges, rows])

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
                  strokeLinejoin="miter"
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
                      onOpenLocation={() => onOpenLocation(p.card)}
                      onOpenAttendance={() => onOpenAttendance(p.card)}
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
