import { expect, test } from '@playwright/test'
import { addCard, card, createBoard } from './helpers'

test('위치 버튼은 위치가 있는 카드에만 보인다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, '위치 없음', '09:00')
  await addCard(page, '위치 있음', '10:00', undefined, undefined, { name: '제주공항' })
  await addCard(page, '주소만', '11:00', undefined, undefined, { address: '서울 강남구 테헤란로 1' })
  await expect(page.getByRole('button', { name: '위치 없음 위치 보기' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '위치 있음 위치 보기' })).toBeVisible()
  await expect(page.getByRole('button', { name: '주소만 위치 보기' })).toBeVisible()
  // 카드에 위치명이 표시된다 (장소명이 없으면 주소)
  await expect(card(page, '위치 있음')).toContainText('제주공항')
  await expect(card(page, '주소만')).toContainText('서울 강남구 테헤란로 1')
})

test('위치 팝오버: 장소명/주소와 지도 링크(주소로 검색), 바깥 클릭/닫기로 닫힌다', async ({ page, isMobile }) => {
  await createBoard(page)
  await addCard(page, '점심', '12:00', undefined, undefined, {
    name: '카페 모닝',
    address: '서울 강남구 테헤란로 1',
  })
  await page.getByRole('button', { name: '점심 위치 보기' }).click()
  const dialog = page.getByRole('dialog', { name: '위치' })
  await expect(dialog.getByText('카페 모닝')).toBeVisible()
  await expect(dialog.getByText('서울 강남구 테헤란로 1')).toBeVisible()

  const q = encodeURIComponent('서울 강남구 테헤란로 1') // 주소로만 검색한다
  const kakao = dialog.getByRole('link', { name: /카카오맵/ })
  const naver = dialog.getByRole('link', { name: /네이버지도/ })
  const google = dialog.getByRole('link', { name: /구글지도/ })
  await expect(kakao).toHaveAttribute('href', `https://map.kakao.com/link/search/${q}`)
  await expect(naver).toHaveAttribute('href', `https://map.naver.com/p/search/${q}`)
  await expect(google).toHaveAttribute('href', `https://www.google.com/maps/search/?api=1&query=${q}`)
  for (const link of [kakao, naver, google]) {
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)
  }
  // 티맵은 모바일에서만 보이고, 앱 실행 주소라 같은 창에서 연다
  const tmap = dialog.getByRole('link', { name: /티맵/ })
  if (isMobile) {
    await expect(tmap).toHaveAttribute('href', `tmap://search?name=${q}`)
    await expect(tmap).not.toHaveAttribute('target', /.+/)
  } else {
    await expect(tmap).toHaveCount(0)
  }
  await expect(dialog.getByRole('link', { name: /내비/ })).toHaveCount(0)
  await expect(dialog.getByText('주소로 검색합니다.')).toBeVisible()

  await dialog.getByRole('button', { name: '닫기' }).click()
  await expect(dialog).toHaveCount(0)

  await page.getByRole('button', { name: '점심 위치 보기' }).click()
  await page.mouse.click(5, 5) // 모달 바깥(배경) 클릭
  await expect(page.getByRole('dialog', { name: '위치' })).toHaveCount(0)

  await page.getByRole('button', { name: '점심 위치 보기' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '위치' })).toHaveCount(0)
})

test('지도 링크를 누르면 새 탭으로 지도 검색이 열린다', async ({ page, context }) => {
  await createBoard(page)
  await addCard(page, '점심', '12:00', undefined, undefined, { name: '제주공항' })
  await page.getByRole('button', { name: '점심 위치 보기' }).click()
  // 외부 사이트에는 실제로 접속하지 않고 요청만 가로채 주소를 확인한다
  await context.route('https://map.kakao.com/**', (route) => route.fulfill({ body: 'ok' }))
  const popup = context.waitForEvent('page')
  await page.getByRole('dialog').getByRole('link', { name: /카카오맵/ }).click()
  const opened = await popup
  expect(opened.url()).toBe(`https://map.kakao.com/link/search/${encodeURIComponent('제주공항')}`)
})

test('카드 모달의 "지도에서 확인"은 입력하면 나타나고 입력한 위치로 연결된다', async ({ page }) => {
  await createBoard(page)
  await page.getByRole('button', { name: '일정 추가' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('link', { name: /지도에서 확인/ })).toHaveCount(0)
  await dialog.getByLabel('위치 (선택)').fill('제주공항')
  const link = dialog.getByRole('link', { name: /지도에서 확인/ })
  await expect(link).toHaveAttribute('href', /map\.kakao\.com\/link\/search\/%EC%A0%9C%EC%A3%BC%EA%B3%B5%ED%95%AD$/)
  await dialog.getByLabel('주소 (선택)').fill('제주시 공항로 2')
  // 주소를 적으면 주소로만 검색한다
  await expect(link).toHaveAttribute('href', new RegExp(encodeURIComponent('제주시 공항로 2') + '$'))
  await dialog.getByLabel('위치 (선택)').fill('')
  await dialog.getByLabel('주소 (선택)').fill('')
  await expect(link).toHaveCount(0)
})

test('주소가 없으면 장소명으로 검색한다고 안내한다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, '점심', '12:00', undefined, undefined, { name: '제주공항' })
  await page.getByRole('button', { name: '점심 위치 보기' }).click()
  const dialog = page.getByRole('dialog', { name: '위치' })
  await expect(dialog.getByText(/주소가 없어 장소명으로 검색/)).toBeVisible()
  await expect(dialog.getByRole('link', { name: /카카오맵/ })).toHaveAttribute(
    'href',
    `https://map.kakao.com/link/search/${encodeURIComponent('제주공항')}`,
  )
})

test('위치는 선택이라 비워도 저장되고, 수정으로 추가/삭제할 수 있다', async ({ page }) => {
  await createBoard(page)
  await addCard(page, '점심', '12:00')
  await expect(page.getByRole('button', { name: '점심 위치 보기' })).toHaveCount(0)

  await page.getByRole('button', { name: '점심 수정' }).click()
  await page.getByRole('dialog').getByLabel('위치 (선택)').fill('제주공항')
  await page.getByRole('dialog').getByRole('button', { name: '저장' }).click()
  await expect(page.getByRole('button', { name: '점심 위치 보기' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: '점심 위치 보기' })).toBeVisible()

  await page.getByRole('button', { name: '점심 수정' }).click()
  await expect(page.getByRole('dialog').getByLabel('위치 (선택)')).toHaveValue('제주공항')
  await page.getByRole('dialog').getByLabel('위치 (선택)').fill('   ') // 공백뿐이면 위치 없음
  await page.getByRole('dialog').getByRole('button', { name: '저장' }).click()
  await expect(page.getByRole('button', { name: '점심 위치 보기' })).toHaveCount(0)
})

test('모바일에서 위치 시트가 아래에 붙고 링크 버튼이 터치하기 충분히 크다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '모바일 전용')
  await createBoard(page)
  await addCard(page, '점심', '12:00', '13:00', undefined, { name: '제주공항' })
  await addCard(page, '커피', '12:00', '13:00', undefined, { name: '카페' }) // 좁은 2열 카드에서도 버튼이 보인다
  await page.getByRole('button', { name: '점심 위치 보기' }).click()
  const dialog = page.getByRole('dialog', { name: '위치' })
  const box = (await dialog.boundingBox())!
  const vp = page.viewportSize()!
  expect(box.y + box.height).toBeGreaterThan(vp.height - 2)
  expect(box.width).toBeGreaterThan(vp.width - 2)
  for (const link of await dialog.getByRole('link').all()) {
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
})
