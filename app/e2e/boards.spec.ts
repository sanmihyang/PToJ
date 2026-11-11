import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('./')
})

test('보드가 없으면 안내와 새 보드 버튼이 보인다', async ({ page }) => {
  await expect(page.getByText('보드가 없습니다')).toBeVisible()
  await expect(page.getByRole('button', { name: '새 보드 만들기' })).toBeVisible()
})

test('이름이 비어 있으면 안내하고 생성하지 않는다', async ({ page }) => {
  await page.getByRole('button', { name: '새 보드 만들기' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '만들기' }).click()
  await expect(page.getByText('보드 이름을 입력해 주세요')).toBeVisible()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('생성 → 이동 → 목록 → 이름 변경 → 복사 → 삭제, 새로고침 후에도 유지', async ({ page }) => {
  // 생성하면 보드 화면으로 이동
  await page.getByRole('button', { name: '새 보드 만들기' }).click()
  await page.getByLabel('보드 이름').fill('제주 여행')
  await page.getByRole('dialog').getByRole('button', { name: '만들기' }).click()
  await expect(page).toHaveURL(/#\/board\/.+/)
  await expect(page.getByRole('heading', { name: '제주 여행' })).toBeVisible()

  // 목록으로
  await page.getByRole('link', { name: '목록으로' }).click()
  await expect(page.getByText('제주 여행')).toBeVisible()
  await expect(page.getByText('카드 0개')).toBeVisible()

  // 이름 변경
  await page.getByRole('button', { name: '제주 여행 더보기' }).click()
  await page.getByRole('menuitem', { name: '이름 변경' }).click()
  await page.getByLabel('보드 이름').fill('부산 여행')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('부산 여행', { exact: true })).toBeVisible()

  // 복사
  await page.getByRole('button', { name: '부산 여행 더보기' }).click()
  await page.getByRole('menuitem', { name: '복사' }).click()
  await expect(page.getByText('부산 여행 복사')).toBeVisible()

  // 새로고침 후에도 유지
  await page.reload()
  await expect(page.getByText('부산 여행', { exact: true })).toBeVisible()
  await expect(page.getByText('부산 여행 복사')).toBeVisible()

  // 삭제 (확인창)
  await page.getByRole('button', { name: '부산 여행 복사 더보기' }).click()
  await page.getByRole('menuitem', { name: '삭제' }).click()
  await expect(page.getByText('복구할 수 없습니다')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click()
  await expect(page.getByText('부산 여행 복사')).toHaveCount(0)
  await expect(page.getByText('부산 여행', { exact: true })).toBeVisible()
})

test('삭제 확인창에서 취소하면 보드가 남는다', async ({ page }) => {
  await page.getByRole('button', { name: '새 보드 만들기' }).click()
  await page.getByLabel('보드 이름').fill('유지')
  await page.getByRole('dialog').getByRole('button', { name: '만들기' }).click()
  await page.getByRole('link', { name: '목록으로' }).click()
  await page.getByRole('button', { name: '유지 더보기' }).click()
  await page.getByRole('menuitem', { name: '삭제' }).click()
  await page.getByRole('button', { name: '취소' }).click()
  await expect(page.getByText('유지', { exact: true })).toBeVisible()
})

test('없는 보드 주소로 가면 안내 후 목록으로 이동한다', async ({ page }) => {
  await page.goto('./#/board/없는-보드')
  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByText('존재하지 않는 보드입니다')).toBeVisible()
})

test('모바일 폭에서 가로 스크롤이 생기지 않는다', async ({ page }) => {
  await page.getByRole('button', { name: '새 보드 만들기' }).click()
  await page.getByLabel('보드 이름').fill('가'.repeat(30))
  await page.getByRole('dialog').getByRole('button', { name: '만들기' }).click()
  await page.getByRole('link', { name: '목록으로' }).click()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})

test('모바일에서 모달은 화면 아래에 붙어 열린다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '모바일 전용')
  await page.getByRole('button', { name: '새 보드 만들기' }).click()
  const box = await page.getByRole('dialog').boundingBox()
  const vh = page.viewportSize()!.height
  expect(box!.y + box!.height).toBeGreaterThan(vh - 2)
  expect(box!.width).toBeGreaterThan(page.viewportSize()!.width - 2)
})
