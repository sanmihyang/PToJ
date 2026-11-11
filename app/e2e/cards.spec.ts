import { expect, test, type Page } from '@playwright/test'

const DAY = '2026-01-03'

async function createBoard(page: Page, name = '테스트') {
  await page.goto('./')
  await page.getByRole('button', { name: '새 보드 만들기' }).click()
  await page.getByLabel('보드 이름').fill(name)
  await page.getByRole('dialog').getByRole('button', { name: '만들기' }).click()
  await expect(page).toHaveURL(/#\/board\/.+/)
  await page.goto(`${page.url().split('?')[0]}?d=${DAY}`)
  await expect(page.getByText('2026.01.03')).toBeVisible()
}

async function addCard(page: Page, title: string, start: string, end?: string, content?: string) {
  await page.getByRole('button', { name: '일정 추가' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('제목').fill(title)
  await dialog.getByLabel('시작 시간').fill(start)
  if (end) await dialog.getByLabel('종료 시간').fill(end)
  if (content) await dialog.getByLabel('내용').fill(content)
  await dialog.getByRole('button', { name: '저장' }).click()
  await expect(dialog).toHaveCount(0)
}

const card = (page: Page, title: string) => page.locator('[data-card-id]', { hasText: title })

test('빈 보드에는 중앙 + 버튼만 보인다', async ({ page }) => {
  await createBoard(page)
  await expect(page.getByRole('button', { name: '일정 추가' })).toHaveCount(1)
  await expect(page.locator('[data-card-id]')).toHaveCount(0)
})

test('카드는 입력 순서와 상관없이 시간순으로 위에서 아래로 쌓인다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, '저녁', '18:00')
  await addCard(page, '아침', '09:00')
  await addCard(page, '점심', '12:00')
  const y = async (t: string) => (await card(page, t).boundingBox())!.y
  expect(await y('아침')).toBeLessThan(await y('점심'))
  expect(await y('점심')).toBeLessThan(await y('저녁'))
  // 기본 연결선: 줄 사이 2개, 화살표 없음
  await expect(page.locator('path[data-edge="vertical"]')).toHaveCount(2)
  await expect(page.locator('path[marker-end]')).toHaveCount(0)
})

test('시간이 겹치는 카드는 같은 줄에서 먼저 작성한 카드가 왼쪽에 놓인다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, '나중시작', '10:00', '11:30') // 먼저 작성
  await addCard(page, '먼저시작', '09:30', '11:00') // 나중에 작성
  const a = (await card(page, '나중시작').boundingBox())!
  const b = (await card(page, '먼저시작').boundingBox())!
  expect(a.x).toBeLessThan(b.x) // 먼저 작성한 카드가 왼쪽
  expect(b.y).toBeLessThan(a.y + a.height) // 같은 줄(세로로 겹침)
  await expect(page.locator('path[data-edge="horizontal"]')).toHaveCount(1)
})

test('날짜를 이동하면 해당 날짜의 카드만 보인다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, '오늘 일정', '09:00')
  await page.getByRole('button', { name: '다음 날' }).click()
  await expect(page.getByText('2026.01.04')).toBeVisible()
  await expect(page.getByText('이 날짜에 일정이 없습니다')).toBeVisible()
  await addCard(page, '내일 일정', '10:00') // 보고 있는 날짜가 기본값
  await expect(card(page, '내일 일정')).toBeVisible()
  await expect(card(page, '오늘 일정')).toHaveCount(0)
  await page.getByRole('button', { name: '이전 날' }).click()
  await expect(card(page, '오늘 일정')).toBeVisible()
  await expect(card(page, '내일 일정')).toHaveCount(0)
})

test('입력 검증: 제목 없음 / 종료가 시작보다 이름', async ({ page }) => {
  await createBoard(page)
  await page.getByRole('button', { name: '일정 추가' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: '저장' }).click()
  await expect(dialog.getByText('제목을 입력해 주세요')).toBeVisible()
  await expect(dialog.getByText('시작 시간을 입력해 주세요')).toBeVisible()
  await dialog.getByLabel('제목').fill('테스트')
  await dialog.getByLabel('시작 시간').fill('10:00')
  await dialog.getByLabel('종료 시간').fill('09:00')
  await dialog.getByRole('button', { name: '저장' }).click()
  await expect(dialog.getByText('종료 시간은 시작 시간보다 늦어야 합니다')).toBeVisible()
  await expect(dialog).toBeVisible()
})

test('수정과 삭제(확인창) 후 새로고침해도 유지된다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, '점심', '12:00', '13:00', '예약 12시 반')
  await expect(card(page, '점심')).toContainText('예약 12시 반')

  await page.getByRole('button', { name: '점심 수정' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('제목')).toHaveValue('점심')
  await dialog.getByLabel('제목').fill('브런치')
  await dialog.getByRole('button', { name: '저장' }).click()
  await expect(card(page, '브런치')).toBeVisible()

  await page.reload()
  await expect(card(page, '브런치')).toBeVisible()

  await page.getByRole('button', { name: '브런치 수정' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click()
  await expect(page.getByText("'브런치' 일정을 삭제할까요?")).toBeVisible()
  await page.getByRole('button', { name: '취소' }).last().click()
  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click()
  await expect(card(page, '브런치')).toBeVisible() // 취소하면 남는다

  await page.getByRole('button', { name: '브런치 수정' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: '삭제' }).click()
  await expect(page.locator('[data-card-id]')).toHaveCount(0)
})

test('다른 탭에서 지운 카드를 저장하면 안내하고 닫기만 가능하다', async ({ page, context }) => {
  await createBoard(page)
  await addCard(page, '점심', '12:00')
  await page.getByRole('button', { name: '점심 수정' }).click()

  const other = await context.newPage()
  await other.goto(page.url())
  await other.getByRole('button', { name: '점심 수정' }).click()
  await other.getByRole('dialog').getByRole('button', { name: '삭제' }).click()
  await other.getByRole('dialog').last().getByRole('button', { name: '삭제' }).click()
  await other.close()

  // 이 탭의 수정 모달은 열려 있다. 저장하면 이미 삭제된 일정이라고 안내한다.
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('제목').fill('수정')
  await dialog.getByRole('button', { name: '저장' }).click()
  await expect(dialog.getByText('이미 삭제된 일정입니다')).toBeVisible()
  await expect(dialog.getByRole('button', { name: '저장' })).toHaveCount(0)
  await dialog.getByRole('button', { name: '닫기' }).click()
  await expect(dialog).toHaveCount(0)
})

test('열이 많아도 페이지 가로 스크롤이 생기지 않고 캔버스 안에서 스크롤된다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, 'A', '09:00', '12:00')
  await addCard(page, 'B', '09:30', '12:00')
  await addCard(page, 'C', '10:00', '12:00')
  const pageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(pageOverflow).toBe(false)
  // 세 카드는 모두 렌더링되고 서로 다른 열에 있다
  const xs = await Promise.all(['A', 'B', 'C'].map(async (t) => (await card(page, t).boundingBox())!.x))
  expect(new Set(xs.map(Math.round)).size).toBe(3)
})

test('모바일에서 카드 2열은 스크롤 없이 한 화면에 들어온다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '모바일 전용')
  await createBoard(page)
  await addCard(page, 'A', '09:00', '10:00')
  await addCard(page, 'B', '09:00', '10:00')
  const vw = page.viewportSize()!.width
  for (const t of ['A', 'B']) {
    const box = (await card(page, t).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(vw)
  }
})
