import { expect, type Page } from '@playwright/test'

export const DAY = '2026-01-03'

export async function createBoard(page: Page, name = '테스트') {
  await page.goto('./')
  await page.getByRole('button', { name: '새 보드 만들기' }).click()
  await page.getByLabel('보드 이름').fill(name)
  await page.getByRole('dialog').getByRole('button', { name: '만들기' }).click()
  await expect(page).toHaveURL(/#\/board\/.+/)
  await page.goto(`${page.url().split('?')[0]}?d=${DAY}`)
  await expect(page.getByText('2026.01.03')).toBeVisible()
}

export async function addCard(
  page: Page,
  title: string,
  start: string,
  end?: string,
  content?: string,
  place?: { name?: string; address?: string },
) {
  await page.getByRole('button', { name: '일정 추가' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('제목').fill(title)
  await dialog.getByLabel('시작 시간').fill(start)
  if (end) await dialog.getByLabel('종료 시간').fill(end)
  if (content) await dialog.getByLabel('내용').fill(content)
  if (place?.name) await dialog.getByLabel('위치 (선택)').fill(place.name)
  if (place?.address) await dialog.getByLabel('주소 (선택)').fill(place.address)
  await dialog.getByRole('button', { name: '저장' }).click()
  await expect(dialog).toHaveCount(0)
}

export const card = (page: Page, title: string) => page.locator('[data-card-id]', { hasText: title })

const SEED_TS = '2026-01-01T09:00:00.000Z'

export interface SeedCard {
  id: string
  title: string
  content?: string
  date: string
  startTime: string
  endTime?: string | null
  placeName?: string | null
  address?: string | null
  isCompleted?: boolean
  created?: number
}

export function seedCard(c: SeedCard) {
  return {
    id: c.id,
    title: c.title,
    content: c.content ?? '',
    date: c.date,
    startTime: c.startTime,
    endTime: c.endTime ?? null,
    placeName: c.placeName ?? null,
    address: c.address ?? null,
    isCompleted: c.isCompleted ?? false,
    completedAt: c.isCompleted ? SEED_TS : null,
    createdAt: new Date(Date.parse(SEED_TS) + (c.created ?? 0) * 1000).toISOString(),
    updatedAt: SEED_TS,
  }
}

export interface SeedBoard {
  id: string
  name: string
  cards: ReturnType<typeof seedCard>[]
  createdAt?: string
  updatedAt?: string
}

/** 페이지가 열리기 전에 localStorage에 데이터를 넣어 둔다 (이미 데이터가 있으면 건드리지 않는다) */
export async function seedBoards(page: Page, boards: SeedBoard[], meta?: Record<string, string>) {
  const data = {
    version: 1,
    boards: boards.map((b) => ({
      id: b.id,
      name: b.name,
      createdAt: b.createdAt ?? SEED_TS,
      updatedAt: b.updatedAt ?? SEED_TS,
      cards: b.cards,
    })),
  }
  await page.addInitScript(
    ([d, m]) => {
      if (!localStorage.getItem('ptoj:data')) localStorage.setItem('ptoj:data', JSON.stringify(d))
      if (m && !localStorage.getItem('ptoj:meta')) localStorage.setItem('ptoj:meta', JSON.stringify(m))
    },
    [data, meta ?? null] as const,
  )
}
