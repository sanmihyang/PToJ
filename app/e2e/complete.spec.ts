import { expect, test } from '@playwright/test'
import { addCard, card, createBoard } from './helpers'

const check = (page: import('@playwright/test').Page, title: string) =>
  page.getByRole('checkbox', { name: `${title} 완료` })
const progress = (page: import('@playwright/test').Page) =>
  page.locator('path[data-edge-state="progress"]')

test('완료 체크하면 녹색 테두리가 되고, 완료한 카드 사이의 연결만 녹색 화살표가 된다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, 'A', '09:00')
  await addCard(page, 'B', '10:00')
  await addCard(page, 'C', '11:00')
  await expect(progress(page)).toHaveCount(0)
  await expect(card(page, 'A')).toHaveAttribute('data-completed', 'false')

  // 한 장만 완료하면 테두리만 바뀌고 선은 그대로 (아직 어디로 가지 않았다)
  await check(page, 'A').click()
  await expect(card(page, 'A')).toHaveAttribute('data-completed', 'true')
  await expect(card(page, 'A')).toHaveClass(/border-emerald-500/)
  await expect(card(page, 'B')).toHaveClass(/border-slate-300/)
  await expect(progress(page)).toHaveCount(0)

  // 다음 카드까지 완료하면 A → B 만 강조된다 (B → C 는 그대로)
  await check(page, 'B').click()
  await expect(progress(page)).toHaveCount(1)
  await expect(progress(page)).toHaveAttribute('marker-end', /progress-arrow/)
  await expect(page.locator('path[data-edge-state="plain"]')).toHaveCount(1)

  await check(page, 'C').click()
  await expect(progress(page)).toHaveCount(2)

  // 가운데를 해제하면 양쪽 선이 모두 원래대로
  await check(page, 'B').click()
  await expect(card(page, 'B')).toHaveAttribute('data-completed', 'false')
  await expect(progress(page)).toHaveCount(0)
})

test('갈라지는 길에서는 완료한 쪽 선만 화살표가 되고 반대쪽은 회색으로 남는다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, 'A', '09:00', '10:00')
  await addCard(page, 'B', '11:00', '12:00')
  await addCard(page, 'C', '11:00', '12:00')
  const arrows = page.locator('path[data-edge="vertical"][data-edge-state="progress"]')
  const plain = page.locator('path[data-edge="vertical"][data-edge-state="plain"]')

  await check(page, 'A').click()
  await expect(arrows).toHaveCount(0) // 아직 어느 쪽으로도 가지 않았다

  await check(page, 'B').click() // B 쪽으로 갔다
  await expect(arrows).toHaveCount(1)
  await expect(arrows).toHaveAttribute('marker-end', /progress-arrow/)
  await expect(plain).toHaveCount(1) // A → C 는 회색 그대로

  await check(page, 'C').click() // C 쪽도 갔다
  await expect(arrows).toHaveCount(2)
  await expect(plain).toHaveCount(0)

  await check(page, 'B').click() // B 쪽을 해제하면 C 쪽만 남는다
  await expect(arrows).toHaveCount(1)
  await expect(plain).toHaveCount(1)
})

test('합쳐지는 길에서는 완료한 카드에서 오는 선만 강조된다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, 'L', '09:00', '10:00')
  await addCard(page, 'R', '09:00', '10:00')
  await addCard(page, 'Z', '12:00')
  const arrows = page.locator('path[data-edge="vertical"][data-edge-state="progress"]')
  await check(page, 'R').click()
  await check(page, 'Z').click() // R을 거쳐 Z로 갔다
  await expect(arrows).toHaveCount(1)
  await expect(page.locator('path[data-edge="vertical"][data-edge-state="plain"]')).toHaveCount(1) // L → Z
})

test('같은 시간축(좌우) 연결은 양쪽이 모두 완료일 때만 화살표 없이 녹색 선이 된다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, 'L', '09:00', '10:00')
  await addCard(page, 'R', '09:00', '10:00')
  const side = page.locator('path[data-edge="horizontal"]')
  await expect(side).toHaveAttribute('data-edge-state', 'plain')
  await check(page, 'R').click()
  await expect(side).toHaveAttribute('data-edge-state', 'plain') // 한쪽만으로는 칠하지 않는다
  await check(page, 'L').click()
  await expect(side).toHaveAttribute('data-edge-state', 'progress')
  await expect(side).not.toHaveAttribute('marker-end', /.+/)
  await check(page, 'L').click()
  await expect(side).toHaveAttribute('data-edge-state', 'plain')
})

test('완료 상태는 새로고침 후에도 유지되고 수정해도 풀리지 않는다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, 'A', '09:00')
  await addCard(page, 'B', '10:00')
  await check(page, 'A').click()
  await check(page, 'B').click()
  await page.reload()
  await expect(card(page, 'A')).toHaveAttribute('data-completed', 'true')
  await expect(progress(page)).toHaveCount(1)

  await page.getByRole('button', { name: 'A 수정' }).click()
  await page.getByRole('dialog').getByLabel('제목').fill('A2')
  await page.getByRole('dialog').getByRole('button', { name: '저장' }).click()
  await expect(card(page, 'A2')).toHaveAttribute('data-completed', 'true')
  await expect(progress(page)).toHaveCount(1)
})

test('시간을 바꿔 줄 순서가 바뀌면 강조도 새 순서를 따라간다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, 'A', '09:00')
  await addCard(page, 'B', '10:00')
  await addCard(page, 'C', '11:00')
  await check(page, 'A').click()
  await check(page, 'B').click() // A → B 강조
  await expect(progress(page)).toHaveCount(1)
  await page.getByRole('button', { name: 'A 수정' }).click()
  await page.getByRole('dialog').getByLabel('시작 시간').fill('12:00') // 순서가 B, C, A
  await page.getByRole('dialog').getByRole('button', { name: '저장' }).click()
  // A와 B가 더 이어져 있지 않으므로 강조되는 선이 없다
  await expect(progress(page)).toHaveCount(0)
  const y = async (t: string) => (await card(page, t).boundingBox())!.y
  expect(await y('B')).toBeLessThan(await y('C'))
  expect(await y('C')).toBeLessThan(await y('A'))
})

test('보드를 복사하면 완료 상태가 초기화된다 (원본은 유지)', async ({ page }) => {
  await createBoard(page, '원본')
  await addCard(page, 'A', '09:00')
  await check(page, 'A').click()
  await expect(card(page, 'A')).toHaveAttribute('data-completed', 'true')

  await page.getByRole('link', { name: '목록으로' }).click()
  await page.getByRole('button', { name: '원본 더보기' }).click()
  await page.getByRole('menuitem', { name: '복사' }).click()
  await page.getByRole('link', { name: /원본 복사/ }).click()
  await page.goto(`${page.url().split('?')[0]}?d=2026-01-03`)
  await expect(card(page, 'A')).toHaveAttribute('data-completed', 'false')

  await page.getByRole('link', { name: '목록으로' }).click()
  await page.getByRole('link', { name: /^원본\s*카드/ }).click()
  await page.goto(`${page.url().split('?')[0]}?d=2026-01-03`)
  await expect(card(page, 'A')).toHaveAttribute('data-completed', 'true')
})

test('모바일에서 완료 버튼이 터치하기 충분히 크다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '모바일 전용')
  await createBoard(page)
  await addCard(page, 'A', '09:00', '10:00')
  await addCard(page, 'B', '09:00', '10:00') // 좁은 2열 카드에서도
  const box = (await check(page, 'A').boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(40)
  await check(page, 'A').click()
  await expect(card(page, 'A')).toHaveAttribute('data-completed', 'true')
})
