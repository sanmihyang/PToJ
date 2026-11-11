import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BoardFormModal from '../components/BoardFormModal'
import ConfirmModal from '../components/ConfirmModal'
import MoreMenu from '../components/MoreMenu'
import { repository, type Board } from '../data'
import { useAppData } from '../hooks/useAppData'
import { errorMessage } from '../lib/errors'
import { formatDate } from '../lib/format'

type Dialog =
  | { type: 'create' }
  | { type: 'rename'; board: Board }
  | { type: 'delete'; board: Board }
  | null

export default function BoardListPage() {
  const { boards } = useAppData()
  const navigate = useNavigate()
  const location = useLocation()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [notice, setNotice] = useState<string | null>(
    (location.state as { notice?: string } | null)?.notice ?? null,
  )
  const [actionError, setActionError] = useState<string | null>(null)

  const sorted = [...boards].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const close = () => setDialog(null)

  function copy(board: Board) {
    try {
      repository.copyBoard(board.id)
      setActionError(null)
    } catch (e) {
      setActionError(errorMessage(e))
    }
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">내 보드</h1>
        {boards.length > 0 && (
          <button
            type="button"
            onClick={() => setDialog({ type: 'create' })}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            새 보드
          </button>
        )}
      </header>

      {notice && (
        <div role="status" className="mb-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="px-2" aria-label="알림 닫기">
            ✕
          </button>
        </div>
      )}
      {actionError && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {boards.length === 0 ? (
        <div className="mt-24 flex flex-col items-center gap-4 text-center">
          <p className="text-slate-600">보드가 없습니다</p>
          <button
            type="button"
            onClick={() => setDialog({ type: 'create' })}
            className="rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white"
          >
            새 보드 만들기
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((board) => (
            <li
              key={board.id}
              className="flex items-center rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <Link to={`/board/${board.id}`} className="min-w-0 flex-1 px-4 py-4">
                <p className="truncate font-medium">{board.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  카드 {board.cards.length}개 · 수정 {formatDate(board.updatedAt)}
                </p>
              </Link>
              <div className="pr-2">
                <MoreMenu
                  label={`${board.name} 더보기`}
                  items={[
                    { label: '이름 변경', onClick: () => setDialog({ type: 'rename', board }) },
                    { label: '복사', onClick: () => copy(board) },
                    { label: '삭제', danger: true, onClick: () => setDialog({ type: 'delete', board }) },
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {dialog?.type === 'create' && (
        <BoardFormModal
          title="새 보드"
          submitLabel="만들기"
          onClose={close}
          onSubmit={(name) => {
            const board = repository.createBoard(name)
            navigate(`/board/${board.id}`)
          }}
        />
      )}
      {dialog?.type === 'rename' && (
        <BoardFormModal
          title="이름 변경"
          submitLabel="저장"
          initialName={dialog.board.name}
          onClose={close}
          onSubmit={(name) => {
            repository.renameBoard(dialog.board.id, name)
            close()
          }}
        />
      )}
      {dialog?.type === 'delete' && (
        <ConfirmModal
          title="보드 삭제"
          message={`'${dialog.board.name}' 보드를 삭제할까요? 카드도 모두 삭제되며 복구할 수 없습니다.`}
          confirmLabel="삭제"
          onClose={close}
          onConfirm={() => {
            repository.deleteBoard(dialog.board.id)
            close()
          }}
        />
      )}
    </main>
  )
}
