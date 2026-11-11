import { expect, test } from '@playwright/test'
import { createBoard } from './helpers'

test('카드 모달의 입력란이 서로 겹치거나 화면을 넘지 않는다', async ({ page }) => {
  await createBoard(page)
  await page.getByRole('button', { name: '일정 추가' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('시작 시간').fill('09:00')
  await dialog.getByLabel('종료 시간').fill('10:00')

  const labels = ['제목', '날짜', '시작 시간', '종료 시간 (선택)', '위치 (선택)', '주소 (선택)', '내용 (선택)']
  const boxes = []
  for (const l of labels) boxes.push({ l, b: (await dialog.getByLabel(l).boundingBox())! })

  const vw = page.viewportSize()!.width
  const panel = (await dialog.boundingBox())!
  for (const { l, b } of boxes) {
    expect(b.x, `${l} 왼쪽`).toBeGreaterThanOrEqual(panel.x)
    expect(b.x + b.width, `${l} 오른쪽`).toBeLessThanOrEqual(Math.min(panel.x + panel.width, vw) + 0.5)
  }
  // 서로 겹치지 않는다
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].b
      const c = boxes[j].b
      const overlap = a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height
      expect(overlap, `${boxes[i].l} ↔ ${boxes[j].l}`).toBe(false)
    }
  }
  // 모달 안/페이지 모두 가로 스크롤이 없다
  const scroll = await dialog.evaluate((el) => ({ panel: el.scrollWidth > el.clientWidth, page: document.documentElement.scrollWidth > document.documentElement.clientWidth }))
  expect(scroll.panel).toBe(false)
  expect(scroll.page).toBe(false)
})

test('모바일에서는 시작/종료 시간이 위아래로 쌓인다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '모바일 전용')
  await createBoard(page)
  await page.getByRole('button', { name: '일정 추가' }).click()
  const dialog = page.getByRole('dialog')
  const start = (await dialog.getByLabel('시작 시간').boundingBox())!
  const end = (await dialog.getByLabel('종료 시간 (선택)').boundingBox())!
  expect(end.y).toBeGreaterThanOrEqual(start.y + start.height)
})

test('아주 좁은 화면(320px)에서도 모달이 넘치지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await createBoard(page)
  await page.getByRole('button', { name: '일정 추가' }).click()
  const dialog = page.getByRole('dialog')
  for (const l of ['날짜', '시작 시간', '종료 시간 (선택)']) {
    const b = (await dialog.getByLabel(l).boundingBox())!
    expect(b.x + b.width, l).toBeLessThanOrEqual(320)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
})
