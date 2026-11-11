const pad = (n: number) => String(n).padStart(2, '0')

/** 로컬 기준 오늘 (YYYY-MM-DD) */
export function todayStr(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** YYYY-MM-DD 에 일수를 더한다 (시간대/서머타임 영향 없음) */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

/** 2026-01-03 → 2026.01.03 */
export function formatDay(date: string): string {
  return date.replaceAll('-', '.')
}
