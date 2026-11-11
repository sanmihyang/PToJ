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
