/** ISO 시각 → 2026.01.01 (사용자 로컬 시간대) */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}.${mm}.${dd}`
}

/** 09:00~10:30 / 종료가 없으면 09:00 */
export function timeLabel(card: { startTime: string; endTime: string | null }): string {
  return card.endTime ? `${card.startTime}~${card.endTime}` : card.startTime
}
