import { useState } from 'react'
import { repository, type Board } from '../data'
import { errorMessage } from '../lib/errors'
import { countCards } from '../lib/backup'
import type { ImportResult } from '../lib/shareFormat'

interface Props {
  result: ImportResult
  /** 가져오기가 끝났을 때. 이동할 보드가 있으면 id를 넘긴다 */
  onDone: (boardId?: string) => void
  onCancel: () => void
}

type Mode = 'merge' | 'replace'

/** 가져올 내용을 보여 주고 확인을 받는다 (보드 1개 / 전체 백업) */
export default function ImportPreview({ result, onDone, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>('merge')
  const [error, setError] = useState<string | null>(null)
  const current = repository.getData().boards

  function run(action: () => string | undefined) {
    try {
      onDone(action())
    } catch (e) {
      setError(errorMessage(e)) // 아무것도 바뀌지 않았다
    }
  }

  if (result.kind === 'board') {
    const board: Board = result.board
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-slate-500">받은 보드</p>
          <p className="break-words text-lg font-bold">{board.name}</p>
          <p className="text-sm text-slate-600">카드 {board.cards.length}개</p>
        </div>
        <p className="text-sm text-slate-600">내 보드에 새 보드로 추가돼요. 기존 보드는 바뀌지 않아요.</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-slate-600">
            취소
          </button>
          <button
            type="button"
            onClick={() => run(() => repository.importBoards([board])[0].id)}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white"
          >
            가져오기
          </button>
        </div>
      </div>
    )
  }

  const { boards } = result
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-slate-500">백업 파일</p>
        <p className="text-lg font-bold">
          보드 {boards.length}개 · 카드 {countCards(boards)}개
        </p>
      </div>
      <div role="radiogroup" aria-label="복원 방식" className="flex flex-col gap-2">
        {([
          ['merge', '합치기', '지금 보드는 그대로 두고, 백업의 보드를 새 보드로 추가해요'],
          ['replace', '현재 데이터 대체', '지금 보드가 모두 사라지고 백업 내용으로 바뀌어요'],
        ] as const).map(([value, label, desc]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-lg border-2 p-3 text-left ${
              mode === value ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300'
            }`}
          >
            <span className="block font-medium">{label}</span>
            <span className="block text-sm text-slate-600">{desc}</span>
          </button>
        ))}
      </div>
      {mode === 'replace' && current.length > 0 && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          지금 보드 {current.length}개(카드 {countCards(current)}개)가 삭제됩니다. 복구할 수 없어요.
        </p>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-slate-600">
          취소
        </button>
        <button
          type="button"
          onClick={() =>
            run(() => {
              if (mode === 'merge') repository.importBoards(boards)
              else repository.replaceAll({ version: repository.getData().version, boards })
              return undefined
            })
          }
          className={`rounded-lg px-4 py-2 font-medium text-white ${mode === 'replace' ? 'bg-red-600' : 'bg-emerald-600'}`}
        >
          {mode === 'replace' ? '대체하기' : '합치기'}
        </button>
      </div>
    </div>
  )
}
