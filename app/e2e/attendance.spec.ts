import { expect, test, type Page } from '@playwright/test'
import { addCard, card, createBoard } from './helpers'

async function setAttendance(page: Page, title: string, on: boolean) {
  await page.getByRole('button', { name: `${title} 수정` }).click()
  const box = page.getByRole('dialog').getByLabel(/참석 여부 받기/)
  if (on) await box.check()
  else await box.uncheck()
  await page.getByRole('dialog').getByRole('button', { name: '저장' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

const manage = (page: Page, title: string) => page.getByRole('button', { name: `${title} 참석자 관리` })

async function addPerson(page: Page, name: string) {
  const dialog = page.getByRole('dialog', { name: '참석자' })
  await dialog.getByLabel('참석자 이름').fill(name)
  await dialog.getByRole('button', { name: '추가' }).click()
}

const choose = (page: Page, name: string, status: '참석' | '불참' | '미정') =>
  page.getByRole('dialog', { name: '참석자' }).getByRole('radiogroup', { name: `${name} 참석 여부` }).getByRole('radio', { name: status })

test('참석 기능이 꺼진 카드에는 참석 영역이 보이지 않는다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, '점심', '12:00')
  await expect(manage(page, '점심')).toHaveCount(0)
})

test('켜면 카드에 참석 영역이 생기고, 이름 추가/상태 변경/삭제가 된다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, '점심', '12:00')
  await setAttendance(page, '점심', true)
  await expect(manage(page, '점심')).toContainText('참석자 추가')

  await manage(page, '점심').click()
  const dialog = page.getByRole('dialog', { name: '참석자' })
  await expect(dialog.getByText('아직 참석자가 없습니다')).toBeVisible()

  await addPerson(page, '민수')
  await addPerson(page, '영희')
  await addPerson(page, '철수')
  await expect(choose(page, '민수', '미정')).toHaveAttribute('aria-checked', 'true') // 새 참석자는 미정
  await expect(dialog.getByText('참석 0명 · 불참 0명 · 미정 3명')).toBeVisible()

  await choose(page, '민수', '참석').click()
  await choose(page, '영희', '불참').click()
  await expect(choose(page, '민수', '참석')).toHaveAttribute('aria-checked', 'true')
  await expect(choose(page, '민수', '미정')).toHaveAttribute('aria-checked', 'false')
  await expect(dialog.getByText('참석 1명 · 불참 1명 · 미정 1명')).toBeVisible()

  // 응답은 바꿀 수 있다
  await choose(page, '영희', '참석').click()
  await expect(dialog.getByText('참석 2명 · 불참 0명 · 미정 1명')).toBeVisible()

  // 삭제
  await dialog.getByRole('button', { name: '철수 삭제' }).click()
  await expect(dialog.getByText('철수')).toHaveCount(0)
  await expect(dialog.getByText('참석 2명 · 불참 0명 · 미정 0명')).toBeVisible()

  await dialog.getByRole('button', { name: '닫기' }).click()
  await expect(manage(page, '점심')).toContainText('참석 2 · 불참 0 · 미정 0')
})

test('빈 이름/중복 이름은 안내하고 추가하지 않는다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, '점심', '12:00')
  await setAttendance(page, '점심', true)
  await manage(page, '점심').click()
  const dialog = page.getByRole('dialog', { name: '참석자' })

  await dialog.getByRole('button', { name: '추가' }).click()
  await expect(dialog.getByText('이름을 입력해 주세요')).toBeVisible()

  await addPerson(page, '민수')
  await addPerson(page, ' 민수 ')
  await expect(dialog.getByText('이미 추가된 이름입니다')).toBeVisible()
  await expect(dialog.getByRole('radiogroup')).toHaveCount(1)
})

test('Enter로도 추가되고 추가 후 입력란이 비워진다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, '점심', '12:00')
  await setAttendance(page, '점심', true)
  await manage(page, '점심').click()
  const input = page.getByRole('dialog', { name: '참석자' }).getByLabel('참석자 이름')
  await input.fill('민수')
  await input.press('Enter')
  await expect(page.getByRole('dialog', { name: '참석자' }).getByRole('radiogroup', { name: '민수 참석 여부' })).toBeVisible()
  await expect(input).toHaveValue('')
})

test('끄면 숨겨지고 응답은 보관되며, 다시 켜면 복원된다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, '점심', '12:00')
  await setAttendance(page, '점심', true)
  await manage(page, '점심').click()
  await addPerson(page, '민수')
  await choose(page, '민수', '참석').click()
  await page.getByRole('dialog', { name: '참석자' }).getByRole('button', { name: '닫기' }).click()

  await setAttendance(page, '점심', false)
  await expect(manage(page, '점심')).toHaveCount(0)

  await page.reload()
  await expect(manage(page, '점심')).toHaveCount(0)

  await setAttendance(page, '점심', true)
  await expect(manage(page, '점심')).toContainText('참석 1 · 불참 0 · 미정 0')
  await manage(page, '점심').click()
  await expect(choose(page, '민수', '참석')).toHaveAttribute('aria-checked', 'true')
})

test('새로고침해도 참석 응답이 유지된다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, '점심', '12:00')
  await setAttendance(page, '점심', true)
  await manage(page, '점심').click()
  await addPerson(page, '민수')
  await choose(page, '민수', '불참').click()
  await page.reload()
  await expect(manage(page, '점심')).toContainText('참석 0 · 불참 1 · 미정 0')
})

test('카드를 처음 만들 때 참석 여부를 켤 수 있다', async ({ page }) => {
  await createBoard(page)
  await page.getByRole('button', { name: '일정 추가' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('제목').fill('모임')
  await dialog.getByLabel('시작 시간').fill('19:00')
  await dialog.getByLabel(/참석 여부 받기/).check()
  await dialog.getByRole('button', { name: '저장' }).click()
  await expect(manage(page, '모임')).toBeVisible()
})

test('보드를 복사하면 참석 기능은 유지되고 응답은 비워진다', async ({ page }) => {
  await createBoard(page, '원본')
  await addCard(page, '점심', '12:00')
  await setAttendance(page, '점심', true)
  await manage(page, '점심').click()
  await addPerson(page, '민수')
  await page.getByRole('dialog', { name: '참석자' }).getByRole('button', { name: '닫기' }).click()

  await page.getByRole('link', { name: '목록으로' }).click()
  await page.getByRole('button', { name: '원본 더보기' }).click()
  await page.getByRole('menuitem', { name: '복사' }).click()
  await page.getByRole('link', { name: /원본 복사/ }).click()
  await page.goto(`${page.url().split('?')[0]}?d=2026-01-03`)
  await expect(manage(page, '점심')).toContainText('참석자 추가') // 응답 없음
  await expect(card(page, '점심')).toBeVisible()
})

test('모바일 좁은 카드에서도 참석 영역이 넘치지 않고 시트가 아래에 붙는다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '모바일 전용')
  await createBoard(page)
  await addCard(page, 'A', '09:00', '10:00')
  await addCard(page, 'B', '09:00', '10:00')
  await setAttendance(page, 'A', true)
  const vw = page.viewportSize()!.width
  const b = (await card(page, 'A').boundingBox())!
  expect(b.x + b.width).toBeLessThanOrEqual(vw)
  await manage(page, 'A').click()
  const dialog = page.getByRole('dialog', { name: '참석자' })
  await addPerson(page, '민수')
  const box = (await dialog.boundingBox())!
  expect(box.y + box.height).toBeGreaterThan(page.viewportSize()!.height - 2)
  for (const r of await dialog.getByRole('radio').all()) {
    expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(40)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
})
