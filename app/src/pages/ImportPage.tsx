import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import ImportPreview from '../components/ImportPreview'
import { ImportError, type ImportResult } from '../lib/shareFormat'
import { boardFromToken } from '../lib/shareLink'

type State =
  | { status: 'loading' }
  | { status: 'ready'; result: ImportResult }
  | { status: 'error'; message: string }

/** 공유 링크(#/import?d=...)로 들어왔을 때의 가져오기 확인 화면 */
export default function ImportPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('d')
  const [state, setState] = useState<State>(() =>
    token ? { status: 'loading' } : { status: 'error', message: '링크에 보드 내용이 없습니다' },
  )

  useEffect(() => {
    let cancelled = false
    if (!token) return
    boardFromToken(token)
      .then((board) => !cancelled && setState({ status: 'ready', result: { kind: 'board', board } }))
      .catch((e) => {
        if (cancelled) return
        setState({
          status: 'error',
          message: e instanceof ImportError ? e.message : '링크 내용을 읽을 수 없습니다',
        })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8">
      <h1 className="mb-6 text-xl font-bold">보드 가져오기</h1>
      {state.status === 'loading' && <p className="text-slate-500">링크를 확인하는 중…</p>}
      {state.status === 'error' && (
        <div className="flex flex-col gap-4">
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-red-700">
            가져올 수 없는 링크입니다. {state.message}
          </p>
          <Link to="/" className="self-start rounded-lg bg-slate-200 px-4 py-2 font-medium">
            목록으로
          </Link>
        </div>
      )}
      {state.status === 'ready' && (
        <ImportPreview
          result={state.result}
          onCancel={() => navigate('/', { replace: true })}
          onDone={(boardId) => navigate(boardId ? `/board/${boardId}` : '/', { replace: true })}
        />
      )}
    </main>
  )
}
