import type { Card } from '../data'

/**
 * 일간 flow chart 배치 (순수 함수)
 *
 * 규칙
 * - 겹침: [시작, 종료) 구간이 겹치면 겹침. 종료 시간이 없는 카드는 시작 시점 한 점으로 본다
 *   (다른 카드 구간 안에 들어오거나 시작 시간이 같을 때만 겹침, 종료 시각과 같은 시작은 겹치지 않음).
 * - 줄(row): 겹침이 이어지는 카드 묶음 하나가 한 줄. 줄은 시작 시간 순으로 위에서 아래로 쌓는다.
 * - 열(col): 같은 줄에서 서로 겹치는 카드는 먼저 작성된 카드가 왼쪽 열을 차지한다.
 * - offset: 줄 안에서 시작 시간이 늦을수록 아래로 조금 내린다 (0~1 비율, 화면에서 px로 환산).
 */

export interface PlacedCard {
  card: Card
  col: number
  /** 0(줄의 맨 위) ~ 1 미만 */
  offset: number
}

export interface LayoutRow {
  /** 열 순서, 같은 열에서는 시작 시간 순 */
  cards: PlacedCard[]
  columns: number
}

export interface Edge {
  from: string
  to: string
  /** vertical: 다음 줄로 이어지는 연결, horizontal: 같은 시간축(좌우) 연결 */
  kind: 'vertical' | 'horizontal'
}

function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}

/** [start, end) — 종료 시간이 없으면 시작 시점 한 점(0.5분)으로 취급 */
function span(card: Card): [number, number] {
  const start = toMinutes(card.startTime)
  return [start, card.endTime ? toMinutes(card.endTime) : start + 0.5]
}

export function overlaps(a: Card, b: Card): boolean {
  const [as, ae] = span(a)
  const [bs, be] = span(b)
  return as < be && bs < ae
}

function byStart(a: Card, b: Card): number {
  return (
    toMinutes(a.startTime) - toMinutes(b.startTime) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  )
}

function byCreated(a: Card, b: Card): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

export function layoutCards(cards: Card[]): LayoutRow[] {
  const sorted = [...cards].sort(byStart)

  // 겹침이 이어지는 묶음(줄)으로 나눈다
  const clusters: Card[][] = []
  let clusterEnd = -Infinity
  for (const card of sorted) {
    const [start, end] = span(card)
    if (clusters.length > 0 && start < clusterEnd) {
      clusters[clusters.length - 1].push(card)
      clusterEnd = Math.max(clusterEnd, end)
    } else {
      clusters.push([card])
      clusterEnd = end
    }
  }

  return clusters.map((cluster) => {
    // 먼저 작성된 카드부터 비어 있는 가장 왼쪽 열에 놓는다
    const colOf = new Map<string, number>()
    for (const card of [...cluster].sort(byCreated)) {
      const used = new Set<number>()
      for (const other of cluster) {
        const col = colOf.get(other.id)
        if (col !== undefined && overlaps(card, other)) used.add(col)
      }
      let col = 0
      while (used.has(col)) col++
      colOf.set(card.id, col)
    }

    const rowStart = Math.min(...cluster.map((c) => span(c)[0]))
    const rowEnd = Math.max(...cluster.map((c) => span(c)[1]))
    const placed: PlacedCard[] = cluster.map((card) => ({
      card,
      col: colOf.get(card.id)!,
      offset: rowEnd > rowStart ? (span(card)[0] - rowStart) / (rowEnd - rowStart) : 0,
    }))
    placed.sort((a, b) => a.col - b.col || byStart(a.card, b.card))
    return { cards: placed, columns: Math.max(...placed.map((p) => p.col)) + 1 }
  })
}

/** 연결선 목록. 다음 줄의 모든 카드로 이어지고, 같은 줄의 겹치는 인접 열끼리 좌우로 이어진다. */
export function buildEdges(rows: LayoutRow[]): Edge[] {
  const edges: Edge[] = []
  for (let r = 0; r < rows.length - 1; r++) {
    for (const a of rows[r].cards) {
      for (const b of rows[r + 1].cards) {
        edges.push({ from: a.card.id, to: b.card.id, kind: 'vertical' })
      }
    }
  }
  for (const row of rows) {
    for (let i = 0; i < row.cards.length; i++) {
      for (let j = i + 1; j < row.cards.length; j++) {
        const a = row.cards[i]
        const b = row.cards[j]
        if (Math.abs(a.col - b.col) !== 1 || !overlaps(a.card, b.card)) continue
        const [left, right] = a.col < b.col ? [a, b] : [b, a]
        edges.push({ from: left.card.id, to: right.card.id, kind: 'horizontal' })
      }
    }
  }
  return edges
}

export interface StyledEdge extends Edge {
  /** true: 실제 진행한 흐름으로 강조 (녹색). false: 기본 회색 선 */
  highlighted: boolean
}

/**
 * 연결선 강조 규칙
 * - vertical: 완료한 카드(위)에서 나가는 연결만 강조 (다음 줄의 모든 카드로, 화살표)
 * - horizontal: 좌우 두 카드 중 하나라도 완료면 강조 (화살표 없음)
 */
export function styleEdges(edges: Edge[], cards: Card[]): StyledEdge[] {
  const done = new Set(cards.filter((c) => c.isCompleted).map((c) => c.id))
  return edges.map((e) => ({
    ...e,
    highlighted: e.kind === 'vertical' ? done.has(e.from) : done.has(e.from) || done.has(e.to),
  }))
}
