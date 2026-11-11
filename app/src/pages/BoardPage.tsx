import { Link, Navigate, useParams } from 'react-router-dom'
import { useAppData } from '../hooks/useAppData'

export default function BoardPage() {
  const { id } = useParams()
  const { boards } = useAppData()
  const board = boards.find((b) => b.id === id)

  if (!board) {
    return <Navigate to="/" replace state={{ notice: '존재하지 않는 보드입니다' }} />
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pt-4">
      <header className="flex items-center gap-2">
        <Link to="/" aria-label="목록으로" className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-slate-100">
          ←
        </Link>
        <h1 className="truncate text-lg font-bold">{board.name}</h1>
      </header>
    </main>
  )
}
