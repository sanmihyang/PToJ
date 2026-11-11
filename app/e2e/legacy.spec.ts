import { expect, test } from '@playwright/test'
import { card } from './helpers'

// 참석 기능을 제거하기 전에 저장된 데이터가 그대로 열리는지 확인한다
test('참석 필드가 남아 있는 예전 데이터도 열리고, 수정하면 필드가 정리된다', async ({ page }) => {
  const ts = '2026-01-01T09:00:00.000Z'
  const legacy = {
    version: 1,
    boards: [
      {
        id: 'b1',
        name: '예전 보드',
        createdAt: ts,
        updatedAt: ts,
        cards: [
          {
            id: 'c1',
            title: '옛 일정',
            content: '',
            date: '2026-01-03',
            startTime: '09:00',
            endTime: null,
            placeName: null,
            address: null,
            isCompleted: false,
            completedAt: null,
            attendanceEnabled: true,
            attendees: [{ id: 'a1', name: '민수', status: 'yes' }],
            createdAt: ts,
            updatedAt: ts,
          },
        ],
      },
    ],
  }
  await page.addInitScript((data) => {
    if (!localStorage.getItem('ptoj:data')) localStorage.setItem('ptoj:data', JSON.stringify(data))
  }, legacy)

  await page.goto('./#/board/b1?d=2026-01-03')
  await expect(page.getByRole('alert')).toHaveCount(0) // 손상 안내가 뜨지 않는다
  await expect(card(page, '옛 일정')).toBeVisible()
  await expect(page.getByText('참석')).toHaveCount(0)

  await page.getByRole('checkbox', { name: '옛 일정 완료' }).click() // 저장이 일어난다
  const saved = await page.evaluate(() => localStorage.getItem('ptoj:data') ?? '')
  expect(saved).not.toContain('attendees')
  expect(saved).not.toContain('attendanceEnabled')
  expect(saved).toContain('옛 일정')
})
