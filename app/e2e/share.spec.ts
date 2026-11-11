import { readFileSync } from 'node:fs'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { card, seedBoards, seedCard } from './helpers'

const DAY = '2026-01-03'

const trip = {
  id: 'trip',
  name: '제주 여행',
  cards: [
    seedCard({ id: 'a', title: '공항 도착', date: DAY, startTime: '09:00', endTime: '10:00', placeName: '제주공항', address: '제주 제주시 공항로 2', isCompleted: true, created: 1, content: '렌터카 수령' }),
    seedCard({ id: 'b', title: '전시 관람', date: DAY, startTime: '10:30', endTime: '12:30', created: 2 }),
    seedCard({ id: 'c', title: '카페', date: DAY, startTime: '11:00', endTime: '12:00', created: 3 }),
  ],
}

/** 다른 기기처럼 저장소가 비어 있는 새 브라우저 */
async function newDevice(browser: Browser) {
  const { defaultBrowserType: _ignored, ...use } = test.info().project.use
  void _ignored
  const context = await browser.newContext(use)
  return { context, page: await context.newPage() }
}

const openBoard = (page: Page, id = 'trip') => page.goto(`./#/board/${id}?d=${DAY}`)
const openShare = async (page: Page) => {
  await page.getByRole('button', { name: '공유', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '공유' })).toBeVisible()
}
const shareLink = (page: Page) => page.getByLabel('공유 링크 주소').inputValue()

test.describe('공유 창', () => {
  test.beforeEach(async ({ page }) => {
    await seedBoards(page, [trip])
    await openBoard(page)
  })

  test('이미지/링크/파일/복사 항목이 보인다', async ({ page }) => {
    await openShare(page)
    const dialog = page.getByRole('dialog', { name: '공유' })
    await expect(dialog.getByRole('button', { name: '이미지 파일로 저장' })).toBeEnabled()
    await expect(dialog.getByRole('button', { name: '링크 복사' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'JSON 파일 저장' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: '보드 복사' })).toBeVisible()
    expect(await shareLink(page)).toMatch(/\/PToJ\/#\/import\?d=[A-Za-z0-9_-]+$/)
    await expect(dialog.getByText(/서버에는 올라가지 않지만/)).toBeVisible()
  })

  test('링크 복사: 클립보드에 링크가 들어간다', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', '클립보드 권한 지정은 chromium에서만')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openShare(page)
    await page.getByRole('button', { name: '링크 복사' }).click()
    await expect(page.getByText('링크를 복사했어요')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await shareLink(page))
  })

  test('보드 복사: 새 보드가 만들어지고 완료 표시는 초기화된다', async ({ page }) => {
    await openShare(page)
    await page.getByRole('dialog', { name: '공유' }).getByRole('button', { name: '보드 복사' }).click()
    await expect(page.getByRole('heading', { name: '제주 여행 복사' })).toBeVisible()
    await page.goto(page.url().split('?')[0] + `?d=${DAY}`)
    await expect(card(page, '공항 도착')).toHaveAttribute('data-completed', 'false')
  })

  test('카드가 아주 많으면 링크 대신 JSON 파일을 안내한다', async ({ browser }) => {
    const rand = () => Math.random().toString(36).slice(2, 10)
    const many = Array.from({ length: 300 }, (_, i) =>
      seedCard({
        id: `m${i}`,
        title: `일정 ${rand()}`,
        content: `메모 ${rand()}${rand()} 내용`,
        date: `2026-02-${String((i % 28) + 1).padStart(2, '0')}`,
        startTime: `${String(8 + (i % 12)).padStart(2, '0')}:00`,
        placeName: `장소 ${rand()}`,
        address: `서울 ${rand()}로 ${i}`,
        created: i,
      }),
    )
    const dev = await newDevice(browser)
    const p2 = dev.page
    await seedBoards(p2, [{ id: 'big', name: '큰 보드', cards: many }])
    await p2.goto(`./#/board/big?d=2026-02-05`)
    await openShare(p2)
    const dialog = p2.getByRole('dialog', { name: '공유' })
    await expect(dialog.getByText(/카드가 많아 링크로 공유하기 어렵습니다/)).toBeVisible()
    await expect(dialog.getByLabel('공유 링크 주소')).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'JSON 파일 저장' })).toBeVisible()
    await dev.context.close()
  })
})

test.describe('공유 링크로 가져오기', () => {
  test('다른 기기에서 링크를 열면 확인 후 새 보드로 추가된다 (내용/완료/위치/순서 유지)', async ({ page, browser }) => {
    await seedBoards(page, [trip])
    await openBoard(page)
    await openShare(page)
    const url = await shareLink(page)

    const other = await newDevice(browser)
    await other.page.goto(url)
    await expect(other.page.getByRole('heading', { name: '보드 가져오기' })).toBeVisible()
    await expect(other.page.getByText('제주 여행')).toBeVisible()
    await expect(other.page.getByText('카드 3개')).toBeVisible()
    await other.page.getByRole('button', { name: '가져오기' }).click()

    await expect(other.page).toHaveURL(/#\/board\/.+/)
    await expect(other.page.getByRole('heading', { name: '제주 여행' })).toBeVisible()
    await other.page.goto(other.page.url().split('?')[0] + `?d=${DAY}`)
    await expect(card(other.page, '공항 도착')).toHaveAttribute('data-completed', 'true')
    await expect(card(other.page, '전시 관람')).toHaveAttribute('data-completed', 'false')
    await expect(card(other.page, '공항 도착')).toContainText('렌터카 수령')
    await expect(other.page.getByRole('button', { name: '공항 도착 위치 보기' })).toBeVisible()
    // 겹치는 카드는 먼저 작성한 카드가 왼쪽
    const x = async (t: string) => (await card(other.page, t).boundingBox())!.x
    expect(await x('전시 관람')).toBeLessThan(await x('카페'))
    // 목록에도 보인다
    await other.page.getByRole('link', { name: '목록으로' }).click()
    await expect(other.page.getByText('카드 3개')).toBeVisible()
    await other.context.close()
  })

  test('이미 데이터가 있는 기기에서도 기존 보드는 그대로 두고 새 보드로 추가한다', async ({ page }) => {
    await seedBoards(page, [trip, { id: 'mine', name: '연습 보드', cards: [] }])
    await openBoard(page)
    await openShare(page)
    const url = await shareLink(page)
    await page.goto(url)
    await page.getByRole('button', { name: '가져오기' }).click()
    await page.getByRole('link', { name: '목록으로' }).click()
    await expect(page.getByText('연습 보드')).toBeVisible()
    await expect(page.getByText('제주 여행', { exact: true })).toHaveCount(2) // 원래 것 + 가져온 것
  })

  test('취소하면 아무것도 추가되지 않는다', async ({ page, browser }) => {
    const sender = await newDevice(browser)
    await seedBoards(sender.page, [trip])
    await sender.page.goto(`./#/board/trip?d=${DAY}`)
    await openShare(sender.page)
    const url = await shareLink(sender.page)
    await sender.context.close()

    await seedBoards(page, [{ id: 'mine', name: '연습 보드', cards: [] }])
    await page.goto(url)
    await page.getByRole('button', { name: '취소' }).click()
    await expect(page).toHaveURL(/#\/$/)
    await expect(page.getByText('제주 여행')).toHaveCount(0)
  })

  for (const [name, hash] of [
    ['토큰이 없는 링크', '#/import'],
    ['깨진 토큰', '#/import?d=abc'],
    ['형식이 잘못된 토큰', '#/import?d=%%%'],
    ['압축 데이터가 아닌 토큰', '#/import?d=aGVsbG8gd29ybGQ'],
  ] as const) {
    test(`가져올 수 없는 링크: ${name}`, async ({ page }) => {
      await seedBoards(page, [{ id: 'mine', name: '연습 보드', cards: [] }])
      await page.goto(`./${hash}`)
      await expect(page.getByRole('alert')).toContainText('가져올 수 없는 링크입니다')
      await page.getByRole('link', { name: '목록으로' }).click()
      await expect(page.getByText('연습 보드')).toBeVisible() // 기존 데이터는 그대로
    })
  }

  test('잘린 링크는 거부한다', async ({ page }) => {
    await seedBoards(page, [trip])
    await openBoard(page)
    await openShare(page)
    const url = await shareLink(page)
    await page.goto(url.slice(0, url.length - 40))
    await expect(page.getByRole('alert')).toContainText('가져올 수 없는 링크입니다')
  })

  test('목록의 가져오기에 링크를 붙여넣어도 된다', async ({ page, browser }) => {
    await seedBoards(page, [trip])
    await openBoard(page)
    await openShare(page)
    const url = await shareLink(page)

    const other = await newDevice(browser)
    await other.page.goto('./')
    await other.page.getByRole('button', { name: '가져오기' }).click()
    const dialog = other.page.getByRole('dialog', { name: '가져오기' })
    await dialog.getByLabel('공유 링크').fill(`보세요! ${url} 감사합니다`)
    await dialog.getByRole('button', { name: '확인' }).click()
    await expect(dialog.getByText('카드 3개')).toBeVisible()
    await dialog.getByRole('button', { name: '가져오기' }).click()
    await expect(other.page).toHaveURL(/#\/board\/.+/)
    await other.context.close()
  })

  test('링크가 아닌 글을 붙여넣으면 안내한다', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: '가져오기' }).click()
    const dialog = page.getByRole('dialog', { name: '가져오기' })
    await dialog.getByLabel('공유 링크').fill('안녕하세요')
    await dialog.getByRole('button', { name: '확인' }).click()
    await expect(dialog.getByText('공유 링크를 붙여넣어 주세요')).toBeVisible()
  })
})

test.describe('JSON 파일', () => {
  test('보드 파일을 저장하고 다른 기기에서 가져온다', async ({ page, browser }) => {
    await seedBoards(page, [trip])
    await openBoard(page)
    await openShare(page)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('dialog', { name: '공유' }).getByRole('button', { name: 'JSON 파일 저장' }).click(),
    ])
    expect(download.suggestedFilename().normalize('NFC')).toBe('제주 여행.ptoj.json')
    const path = (await download.path())!
    const json = JSON.parse(readFileSync(path, 'utf8'))
    expect(json.app).toBe('ptoj')
    expect(json.version).toBe(1)
    expect(json.board.cards).toHaveLength(3)

    const other = await newDevice(browser)
    await other.page.goto('./')
    await other.page.getByRole('button', { name: '가져오기' }).click()
    await other.page.getByLabel('파일 선택').setInputFiles(path)
    await expect(other.page.getByText('카드 3개')).toBeVisible()
    await other.page.getByRole('dialog').getByRole('button', { name: '가져오기' }).click()
    await expect(other.page).toHaveURL(/#\/board\/.+/)
    await other.page.goto(other.page.url().split('?')[0] + `?d=${DAY}`)
    await expect(card(other.page, '공항 도착')).toHaveAttribute('data-completed', 'true')
    await other.context.close()
  })

  test('목록의 더보기에서도 보드를 JSON으로 내보낼 수 있다', async ({ page }) => {
    await seedBoards(page, [trip])
    await page.goto('./')
    await page.getByRole('button', { name: '제주 여행 더보기' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'JSON 내보내기' }).click(),
    ])
    expect(download.suggestedFilename().normalize('NFC')).toBe('제주 여행.ptoj.json')
  })

  for (const [name, content, message] of [
    ['JSON이 아닌 파일', '안녕하세요', 'JSON 형식이 아닙니다'],
    ['다른 앱의 JSON', JSON.stringify({ hello: 'world' }), '이 앱에서 만든 파일이 아닙니다'],
    ['지원하지 않는 버전', JSON.stringify({ app: 'ptoj', version: 9, board: {} }), '지원하지 않는 버전'],
    ['규칙에 어긋난 보드', JSON.stringify({ app: 'ptoj', version: 1, board: { name: '' , cards: [] } }), '형식이 올바르지 않습니다'],
  ] as const) {
    test(`잘못된 파일은 안내만 하고 데이터를 바꾸지 않는다: ${name}`, async ({ page }) => {
      await seedBoards(page, [{ id: 'mine', name: '연습 보드', cards: [] }])
      await page.goto('./')
      await page.getByRole('button', { name: '데이터 메뉴' }).click()
      await page.getByRole('menuitem', { name: '가져오기' }).click()
      await page.getByLabel('파일 선택').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(content) })
      await expect(page.getByRole('dialog').getByRole('alert')).toContainText(message)
      await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click()
      await expect(page.getByText('연습 보드')).toBeVisible()
      await expect(page.getByRole('link', { name: /연습 보드/ })).toHaveCount(1)
    })
  }
})

test.describe('전체 백업/복원', () => {
  const second = { id: 'busan', name: '부산', cards: [seedCard({ id: 'z', title: '해운대', date: DAY, startTime: '10:00' })] }

  async function makeBackup(page: Page) {
    await page.goto('./')
    await page.getByRole('button', { name: '데이터 메뉴' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: '전체 백업 저장' }).click(),
    ])
    return download
  }

  test('백업 파일을 저장하면 모든 보드가 들어 있다', async ({ page }) => {
    await seedBoards(page, [trip, second])
    const download = await makeBackup(page)
    expect(download.suggestedFilename().normalize('NFC')).toMatch(/^ptoj-backup-\d{8}\.json$/)
    const json = JSON.parse(readFileSync((await download.path())!, 'utf8'))
    expect(json.backup).toBe(true)
    expect(json.boards.map((b: { name: string }) => b.name)).toEqual(['제주 여행', '부산'])
  })

  test('삭제 후 백업 파일로 복원하면 돌아온다 (합치기)', async ({ page }) => {
    await seedBoards(page, [trip, second])
    const path = (await (await makeBackup(page)).path())!
    // 전부 지운다
    for (const name of ['제주 여행', '부산']) {
      await page.getByRole('button', { name: `${name} 더보기` }).click()
      await page.getByRole('menuitem', { name: '삭제' }).click()
      await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click()
    }
    await expect(page.getByText('보드가 없습니다')).toBeVisible()

    await page.getByRole('button', { name: '가져오기' }).click()
    await page.getByLabel('파일 선택').setInputFiles(path)
    await expect(page.getByText('보드 2개 · 카드 4개')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: '합치기' }).last().click()
    await expect(page).toHaveURL(/#\/$/)
    await expect(page.getByText('제주 여행')).toBeVisible()
    await expect(page.getByText('부산')).toBeVisible()
  })

  test('합치기는 지금 보드를 그대로 두고 추가한다 (중복되면 둘 다 남는다)', async ({ page }) => {
    await seedBoards(page, [trip, second])
    const path = (await (await makeBackup(page)).path())!
    await page.getByRole('button', { name: '데이터 메뉴' }).click()
    await page.getByRole('menuitem', { name: '가져오기' }).click()
    await page.getByLabel('파일 선택').setInputFiles(path)
    await page.getByRole('dialog').getByRole('button', { name: '합치기' }).last().click()
    await expect(page.getByText('제주 여행', { exact: true })).toHaveCount(2)
    await expect(page.getByText('부산', { exact: true })).toHaveCount(2)
  })

  test('현재 데이터 대체: 경고가 보이고 확인하면 백업 내용으로 바뀐다', async ({ page }) => {
    await seedBoards(page, [trip, second])
    const path = (await (await makeBackup(page)).path())!
    // 백업 이후 보드를 하나 더 만든다
    await page.getByRole('button', { name: '새 보드' }).click()
    await page.getByLabel('보드 이름').fill('백업 뒤에 만든 보드')
    await page.getByRole('dialog').getByRole('button', { name: '만들기' }).click()
    await page.getByRole('link', { name: '목록으로' }).click()
    await expect(page.getByText('백업 뒤에 만든 보드')).toBeVisible()

    await page.getByRole('button', { name: '데이터 메뉴' }).click()
    await page.getByRole('menuitem', { name: '가져오기' }).click()
    await page.getByLabel('파일 선택').setInputFiles(path)
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('radio', { name: /현재 데이터 대체/ }).click()
    await expect(dialog.getByRole('alert')).toContainText('지금 보드 3개')
    await expect(dialog.getByRole('alert')).toContainText('복구할 수 없어요')
    await dialog.getByRole('button', { name: '대체하기' }).click()
    await expect(page.getByText('백업 뒤에 만든 보드')).toHaveCount(0)
    await expect(page.getByText('제주 여행')).toBeVisible()
    await expect(page.getByText('부산')).toBeVisible()
  })

  test('대체를 취소하면 아무것도 바뀌지 않는다', async ({ page }) => {
    await seedBoards(page, [trip, second])
    const path = (await (await makeBackup(page)).path())!
    await page.getByRole('button', { name: '데이터 메뉴' }).click()
    await page.getByRole('menuitem', { name: '가져오기' }).click()
    await page.getByLabel('파일 선택').setInputFiles(path)
    await page.getByRole('dialog').getByRole('radio', { name: /현재 데이터 대체/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: '취소' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click()
    await expect(page.getByText('제주 여행', { exact: true })).toHaveCount(1)
  })

  test('보드가 없을 때도 가져오기를 쓸 수 있다 (새 기기 복원)', async ({ page }) => {
    await page.goto('./')
    await expect(page.getByText('보드가 없습니다')).toBeVisible()
    await expect(page.getByRole('button', { name: '가져오기' })).toBeVisible()
  })
})

test.describe('백업 권장 안내', () => {
  const dayAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()

  test('오래 백업하지 않고 변경이 있으면 안내하고, 백업하면 사라진다', async ({ page }) => {
    await seedBoards(page, [{ ...trip, createdAt: dayAgo(30), updatedAt: dayAgo(20) }])
    await page.goto('./')
    await expect(page.getByRole('status')).toContainText('백업 파일')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '백업 저장' }).click(),
    ])
    expect(download.suggestedFilename().normalize('NFC')).toMatch(/^ptoj-backup-/)
    await expect(page.getByRole('status')).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('"나중에"를 누르면 한동안 다시 보이지 않는다', async ({ page }) => {
    await seedBoards(page, [{ ...trip, createdAt: dayAgo(30), updatedAt: dayAgo(20) }])
    await page.goto('./')
    await page.getByRole('button', { name: '나중에' }).click()
    await expect(page.getByRole('status')).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('최근에 만든 보드에는 안내하지 않는다', async ({ page }) => {
    await seedBoards(page, [{ ...trip, createdAt: dayAgo(1), updatedAt: dayAgo(1) }])
    await page.goto('./')
    await expect(page.getByRole('link', { name: /제주 여행/ })).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  test('백업 이후 변경이 없으면 안내하지 않는다', async ({ page }) => {
    await seedBoards(
      page,
      [{ ...trip, createdAt: dayAgo(30), updatedAt: dayAgo(20) }],
      { lastBackupAt: dayAgo(10) },
    )
    await page.goto('./')
    await expect(page.getByRole('link', { name: /제주 여행/ })).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })
})

test.describe('이미지 저장', () => {
  function pngSize(buf: Buffer) {
    expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a') // PNG 시그니처
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }

  test('현재 보는 기간을 PNG로 저장한다', async ({ page }) => {
    await seedBoards(page, [trip])
    await openBoard(page)
    await openShare(page)
    const button = page.getByRole('dialog', { name: '공유' }).getByRole('button', { name: '이미지 파일로 저장' })
    await expect(button).toBeEnabled({ timeout: 15000 })
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()])
    expect(download.suggestedFilename().normalize('NFC')).toBe('제주 여행 2026.01.03.png')
    const { width, height } = pngSize(readFileSync((await download.path())!))
    expect(width).toBeGreaterThan(200)
    expect(height).toBeGreaterThan(300)
    // 캡처가 끝나면 화면은 원래대로 돌아온다
    await expect(page.locator('[data-export-node]')).not.toHaveAttribute('data-exporting', /.+/)
  })

  test('가로 스크롤로 잘리던 넓은 로드맵도 전부 담긴다', async ({ page }) => {
    const wide = {
      id: 'wide',
      name: '넓은 보드',
      cards: ['A', 'B', 'C', 'D'].map((t, i) =>
        seedCard({ id: t, title: `카드${t}`, date: DAY, startTime: '09:00', endTime: '12:00', created: i }),
      ),
    }
    await seedBoards(page, [wide])
    await page.goto(`./#/board/wide?d=${DAY}`)
    // 4열(160px × 4 + 간격)은 모바일 화면보다 넓다
    const visibleWidth = await page.locator('[data-export-node]').evaluate((el) => el.clientWidth)
    await openShare(page)
    const button = page.getByRole('dialog', { name: '공유' }).getByRole('button', { name: '이미지 파일로 저장' })
    await expect(button).toBeEnabled({ timeout: 15000 })
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()])
    const { width } = pngSize(readFileSync((await download.path())!))
    // 배율(최대 2배)을 감안해도 4열 폭(약 700px) 이상이어야 한다
    expect(width / 2).toBeGreaterThanOrEqual(640)
    expect(width / 2).toBeGreaterThan(visibleWidth - 1)
  })

  test('일정이 없는 기간은 이미지로 저장할 수 없다고 안내한다', async ({ page }) => {
    await seedBoards(page, [trip])
    await page.goto(`./#/board/trip?d=2030-05-05`)
    await openShare(page)
    await expect(page.getByRole('dialog', { name: '공유' }).getByText('저장할 일정이 없습니다')).toBeVisible()
    await expect(page.getByRole('dialog', { name: '공유' }).getByRole('button', { name: '이미지 파일로 저장' })).toHaveCount(0)
  })
})

test.describe('사진첩 저장 (기기 공유 화면)', () => {
  type Mode = 'ok' | 'cancel' | 'fail' | 'none'

  /** 기기 공유 화면(navigator.share)을 흉내 낸다. 'none'은 지원하지 않는 환경 */
  async function mockShare(page: Page, mode: Mode) {
    await page.addInitScript((m) => {
      const define = (name: string, value: unknown) =>
        Object.defineProperty(navigator, name, { value, configurable: true, writable: true })
      if (m === 'none') {
        define('canShare', undefined)
        define('share', undefined)
        return
      }
      define('canShare', () => true)
      define('share', async (data: ShareData) => {
        ;(window as unknown as { __shared: unknown }).__shared = (data.files ?? []).map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
        }))
        if (m === 'cancel') throw new DOMException('cancelled', 'AbortError')
        if (m === 'fail') throw new Error('boom')
      })
    }, mode)
  }

  const openImageShare = async (page: Page) => {
    await seedBoards(page, [trip])
    await openBoard(page)
    await openShare(page)
    await expect(page.getByRole('dialog', { name: '공유' }).getByRole('button', { name: '이미지 파일로 저장' })).toBeEnabled({ timeout: 15000 })
  }
  const shared = (page: Page) =>
    page.evaluate(() => (window as unknown as { __shared?: { name: string; type: string; size: number }[] }).__shared)

  test('모바일: "사진에 저장하기"가 기본 버튼이고 누르면 이미지 파일로 공유 화면이 열린다', async ({ page, isMobile }) => {
    test.skip(!isMobile, '모바일 전용')
    await mockShare(page, 'ok')
    await openImageShare(page)
    const dialog = page.getByRole('dialog', { name: '공유' })
    await expect(dialog.getByText(/"이미지 저장"을 누르면 사진첩에 저장돼요/)).toBeVisible()
    await expect(dialog.locator('img')).toHaveCount(0) // 공유 화면을 쓸 수 있으면 미리보기는 필요 없다
    await dialog.getByRole('button', { name: '사진에 저장하기' }).click()
    await expect(dialog.getByText('공유했어요')).toBeVisible()
    const files = (await shared(page))!
    expect(files).toHaveLength(1)
    expect(files[0].type).toBe('image/png')
    expect(files[0].name).toBe('제주 여행 2026.01.03.png')
    expect(files[0].size).toBeGreaterThan(1000)
  })

  test('모바일: 공유 화면에서 취소하면 오류 없이 그대로 둔다', async ({ page, isMobile }) => {
    test.skip(!isMobile, '모바일 전용')
    await mockShare(page, 'cancel')
    await openImageShare(page)
    const dialog = page.getByRole('dialog', { name: '공유' })
    await dialog.getByRole('button', { name: '사진에 저장하기' }).click()
    await expect.poll(() => shared(page)).toBeTruthy() // 공유 화면은 열렸다
    await expect(dialog.getByRole('alert')).toHaveCount(0)
    await expect(dialog.getByText('공유했어요')).toHaveCount(0)
  })

  test('모바일: 공유 화면이 실패하면 안내한다', async ({ page, isMobile }) => {
    test.skip(!isMobile, '모바일 전용')
    await mockShare(page, 'fail')
    await openImageShare(page)
    const dialog = page.getByRole('dialog', { name: '공유' })
    await dialog.getByRole('button', { name: '사진에 저장하기' }).click()
    await expect(dialog.getByRole('alert')).toBeVisible()
  })

  test('모바일: 파일 저장도 그대로 쓸 수 있다', async ({ page, isMobile }) => {
    test.skip(!isMobile, '모바일 전용')
    await mockShare(page, 'ok')
    await openImageShare(page)
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('dialog', { name: '공유' }).getByRole('button', { name: '이미지 파일로 저장' }).click(),
    ])
    expect(download.suggestedFilename().normalize('NFC')).toBe('제주 여행 2026.01.03.png')
  })

  test('모바일에서 공유 화면을 쓸 수 없으면 이미지를 보여 주고 길게 눌러 저장하도록 안내한다', async ({ page, isMobile }) => {
    test.skip(!isMobile, '모바일 전용')
    await mockShare(page, 'none')
    await openImageShare(page)
    const dialog = page.getByRole('dialog', { name: '공유' })
    await expect(dialog.getByRole('button', { name: '사진에 저장하기' })).toHaveCount(0)
    const img = dialog.getByRole('img', { name: /제주 여행 .* 로드맵/ })
    await expect(img).toBeVisible()
    await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/)
    await expect(dialog.getByText(/길게 눌러 "사진에 추가"/)).toBeVisible()
    // 미리보기가 화면을 넘치지 않는다
    const box = (await img.boundingBox())!
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
  })

  test('데스크톱: "사진에 저장하기"와 미리보기는 나오지 않는다', async ({ page, isMobile }) => {
    test.skip(isMobile, '데스크톱 전용')
    await mockShare(page, 'ok')
    await openImageShare(page)
    const dialog = page.getByRole('dialog', { name: '공유' })
    await expect(dialog.getByRole('button', { name: '사진에 저장하기' })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: '이미지 공유하기' })).toBeVisible() // 공유 화면을 지원하면 일반 공유 버튼
    await expect(dialog.locator('img')).toHaveCount(0)
  })
})
