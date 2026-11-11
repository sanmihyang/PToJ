import { expect, test, type Page } from '@playwright/test'

const ts = '2026-01-01T09:00:00.000Z'

function mk(id: string, date: string, start: string, end: string | null = null, created = 0) {
  return {
    id,
    title: id,
    content: '',
    date,
    startTime: start,
    endTime: end,
    placeName: null,
    address: null,
    isCompleted: false,
    completedAt: null,
    createdAt: new Date(Date.parse(ts) + created * 1000).toISOString(),
    updatedAt: ts,
  }
}

// 2026-01-03 = 토요일. 월요일 시작 주: 2025-12-29(월) ~ 2026-01-04(일)
const cards = [
  mk('월요일A', '2025-12-29', '09:00'),
  mk('토요일A', '2026-01-03', '09:00', null, 1),
  mk('토요일B', '2026-01-03', '11:00', null, 2),
  mk('일요일A', '2026-01-04', '10:00'),
  mk('다음월요일', '2026-01-05', '10:00'),
  mk('일월이십', '2026-01-20', '10:00'),
  mk('이월이일', '2026-02-02', '10:00'),
  mk('유월십오', '2026-06-15', '10:00'),
  mk('이천이십칠', '2027-03-01', '10:00'),
]

async function seed(page: Page) {
  await page.addInitScript(
    ([data]) => {
      if (!localStorage.getItem('ptoj:data')) localStorage.setItem('ptoj:data', JSON.stringify(data))
    },
    [{ version: 1, boards: [{ id: 'b1', name: '기간', createdAt: ts, updatedAt: ts, cards }] }],
  )
}

const open = (page: Page, view: string, d = '2026-01-03') => page.goto(`./#/board/b1?v=${view}&d=${d}`)
const sections = (page: Page) => page.locator('section[data-day]')
const days = async (page: Page) => sections(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-day')))
const titles = async (page: Page) =>
  page.locator('[data-card-id]').evaluateAll((els) => els.map((e) => e.querySelector('p.font-semibold')?.textContent))

test.beforeEach(async ({ page }) => {
  await seed(page)
})

test('일간 보기는 그 날의 로드맵만 보여준다 (기본값)', async ({ page }) => {
  await page.goto('./#/board/b1?d=2026-01-03')
  await expect(page.getByRole('radio', { name: '일' })).toHaveAttribute('aria-checked', 'true')
  expect(await titles(page)).toEqual(['토요일A', '토요일B'])
  await expect(page.getByTestId('period-summary')).toHaveCount(0)
})

test('주간: 월~일 기준으로 기간 안의 모든 날의 로드맵을 날짜순으로 보여준다', async ({ page }) => {
  await open(page, 'week')
  await expect(page.getByText('2025.12.29 ~ 2026.01.04')).toBeVisible()
  // 일정이 있는 날만, 날짜순. 다음 주 월요일(01-05)은 포함되지 않는다
  expect(await days(page)).toEqual(['2025-12-29', '2026-01-03', '2026-01-04'])
  expect(await titles(page)).toEqual(['월요일A', '토요일A', '토요일B', '일요일A'])
  await expect(page.getByTestId('period-summary')).toHaveText('3일 · 일정 4개')
  // 연을 넘는 주는 날짜 제목에 연도를 붙인다
  await expect(page.getByRole('button', { name: '2025.12.29 (월) 일간 보기' })).toHaveText('2025.12.29 (월)')
  await expect(page.getByRole('button', { name: '2026.01.04 (일) 일간 보기' })).toHaveText('2026.01.04 (일)')
})

test('월요일에 시작하고 일요일에 끝난다', async ({ page }) => {
  await open(page, 'week', '2026-01-05') // 월요일
  await expect(page.getByText('2026.01.05 ~ 01.11')).toBeVisible()
  expect(await days(page)).toEqual(['2026-01-05'])
  await open(page, 'week', '2026-01-11') // 같은 주의 일요일
  await expect(page.getByText('2026.01.05 ~ 01.11')).toBeVisible()
  await open(page, 'week', '2026-01-04') // 일요일은 그 전 주
  await expect(page.getByText('2025.12.29 ~ 2026.01.04')).toBeVisible()
})

test('월간: 그 달의 모든 날의 로드맵', async ({ page }) => {
  await open(page, 'month')
  await expect(page.getByText('2026.01', { exact: true })).toBeVisible()
  expect(await days(page)).toEqual(['2026-01-03', '2026-01-04', '2026-01-05', '2026-01-20'])
  expect(await titles(page)).toEqual(['토요일A', '토요일B', '일요일A', '다음월요일', '일월이십'])
  await expect(page.getByTestId('period-summary')).toHaveText('4일 · 일정 5개')
  await expect(page.getByRole('button', { name: '2026.01.03 (토) 일간 보기' })).toHaveText('01.03 (토)')
})

test('연간: 그 해의 모든 날의 로드맵 (다른 해는 제외)', async ({ page }) => {
  await open(page, 'year')
  await expect(page.getByText('2026', { exact: true })).toBeVisible()
  expect(await days(page)).toEqual(['2026-01-03', '2026-01-04', '2026-01-05', '2026-01-20', '2026-02-02', '2026-06-15'])
  expect(await titles(page)).not.toContain('월요일A') // 2025
  expect(await titles(page)).not.toContain('이천이십칠') // 2027
})

test('보기 단위를 바꿔도 기준 날짜는 유지되고, 새로고침해도 유지된다', async ({ page }) => {
  await open(page, 'day')
  await page.getByRole('radio', { name: '주' }).click()
  await expect(page).toHaveURL(/v=week/)
  await expect(page.getByText('2025.12.29 ~ 2026.01.04')).toBeVisible()
  await page.getByRole('radio', { name: '월' }).click()
  await expect(page.getByText('2026.01', { exact: true })).toBeVisible()
  await page.getByRole('radio', { name: '연' }).click()
  await page.reload()
  await expect(page.getByRole('radio', { name: '연' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('2026', { exact: true })).toBeVisible()
  await page.getByRole('radio', { name: '일' }).click()
  await expect(page.getByText('2026.01.03')).toBeVisible()
})

test('좌우 버튼은 보기 단위만큼 이동한다', async ({ page }) => {
  await open(page, 'week')
  await page.getByRole('button', { name: '다음 주' }).click()
  await expect(page.getByText('2026.01.05 ~ 01.11')).toBeVisible()
  expect(await days(page)).toEqual(['2026-01-05'])
  await page.getByRole('button', { name: '이전 주' }).click()
  await page.getByRole('button', { name: '이전 주' }).click()
  await expect(page.getByText('2025.12.22 ~ 12.28')).toBeVisible()
  await expect(page.getByText('이 기간에 일정이 없습니다')).toBeVisible()

  await open(page, 'month')
  await page.getByRole('button', { name: '다음 달' }).click()
  await expect(page.getByText('2026.02', { exact: true })).toBeVisible()
  expect(await days(page)).toEqual(['2026-02-02'])
  await page.getByRole('button', { name: '다음 달' }).click()
  await expect(page.getByText('이 기간에 일정이 없습니다')).toBeVisible()

  await open(page, 'year')
  await page.getByRole('button', { name: '다음 해' }).click()
  await expect(page.getByText('2027', { exact: true })).toBeVisible()
  expect(await titles(page)).toEqual(['이천이십칠'])
  await page.getByRole('button', { name: '이전 해' }).click()
  await page.getByRole('button', { name: '이전 해' }).click()
  await expect(page.getByText('2025', { exact: true })).toBeVisible()
  expect(await titles(page)).toEqual(['월요일A'])
})

test('월 이동은 말일을 넘지 않는다 (1/31 → 2월)', async ({ page }) => {
  await open(page, 'month', '2026-01-31')
  await page.getByRole('button', { name: '다음 달' }).click()
  await expect(page.getByText('2026.02', { exact: true })).toBeVisible()
})

test('날짜 제목을 누르면 그 날의 일간 보기로 이동한다', async ({ page }) => {
  await open(page, 'month')
  await page.getByRole('button', { name: '2026.01.20 (화) 일간 보기' }).click()
  await expect(page).toHaveURL(/v=day/)
  await expect(page).toHaveURL(/d=2026-01-20/)
  await expect(page.getByText('2026.01.20')).toBeVisible()
  expect(await titles(page)).toEqual(['일월이십'])
})

test('주간 보기에서도 날짜마다 연결선과 완료 체크가 동작한다', async ({ page }) => {
  await open(page, 'week')
  const sat = page.locator('section[data-day="2026-01-03"]')
  await expect(sat.locator('path[data-edge="vertical"]')).toHaveCount(1) // 토요일A → 토요일B
  await expect(sat.locator('path[data-edge-state="progress"]')).toHaveCount(0)
  await sat.getByRole('checkbox', { name: '토요일A 완료' }).click()
  await expect(sat.locator('path[data-edge-state="progress"]')).toHaveCount(1)
  // 다른 날의 로드맵에는 영향이 없다
  await expect(page.locator('section[data-day="2026-01-04"] path[data-edge]')).toHaveCount(0)
  await expect(page.locator('[data-card-id]', { hasText: '일요일A' })).toHaveAttribute('data-completed', 'false')
})

test('새 일정의 기본 날짜: 오늘이 기간 밖이면 기간의 첫 날', async ({ page }) => {
  for (const [view, d, expected] of [
    ['week', '2026-01-03', '2025-12-29'],
    ['month', '2026-01-03', '2026-01-01'],
    ['year', '2024-05-05', '2024-01-01'], // 오늘이 포함되지 않는 해
  ] as const) {
    await open(page, view, d)
    await page.getByRole('button', { name: '일정 추가' }).click()
    await expect(page.getByRole('dialog').getByLabel('날짜')).toHaveValue(expected)
    await page.getByRole('dialog').getByRole('button', { name: '취소' }).click()
  }
})

test('새 일정의 기본 날짜: 오늘이 기간 안이면 오늘', async ({ page }) => {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  for (const view of ['week', 'month', 'year'] as const) {
    await open(page, view, today)
    await page.getByRole('button', { name: '일정 추가' }).click()
    await expect(page.getByRole('dialog').getByLabel('날짜')).toHaveValue(today)
    await page.getByRole('dialog').getByRole('button', { name: '취소' }).click()
  }
})

test('보는 기간 밖의 날짜로 일정을 저장하면 그 날짜의 기간으로 이동한다', async ({ page }) => {
  await open(page, 'week')
  await page.getByRole('button', { name: '일정 추가' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('제목').fill('새 일정')
  await dialog.getByLabel('날짜').fill('2026-02-10')
  await dialog.getByLabel('시작 시간').fill('09:00')
  await dialog.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('2026.02.09 ~ 02.15')).toBeVisible()
  expect(await titles(page)).toEqual(['새 일정'])
  await expect(page).toHaveURL(/v=week/) // 보기 단위는 유지
})

test('기간 안의 날짜로 저장하면 보던 기간에 그대로 머문다', async ({ page }) => {
  await open(page, 'month')
  await page.getByRole('button', { name: '일정 추가' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('제목').fill('이번 달 일정')
  await dialog.getByLabel('날짜').fill('2026-01-15')
  await dialog.getByLabel('시작 시간').fill('09:00')
  await dialog.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('2026.01', { exact: true })).toBeVisible()
  expect(await days(page)).toContain('2026-01-15')
})

test('일정이 없는 기간 안내', async ({ page }) => {
  await open(page, 'month', '2026-03-10')
  await expect(page.getByText('이 기간에 일정이 없습니다')).toBeVisible()
  await open(page, 'day', '2026-03-10')
  await expect(page.getByText('이 날짜에 일정이 없습니다')).toBeVisible()
})

test('모바일에서 보기 전환/연간 보기가 화면을 넘치지 않는다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '모바일 전용')
  await open(page, 'year')
  const vw = page.viewportSize()!.width
  for (const mode of ['일', '주', '월', '연']) {
    const b = (await page.getByRole('radio', { name: mode }).boundingBox())!
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.x + b.width).toBeLessThanOrEqual(vw)
    expect(b.height).toBeGreaterThanOrEqual(36)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
})
