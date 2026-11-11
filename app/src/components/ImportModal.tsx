import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MAX_IMPORT_CHARS, ImportError, parseImport, type ImportResult } from '../lib/shareFormat'
import { boardFromToken, tokenFromText } from '../lib/shareLink'
import ImportPreview from './ImportPreview'
import Modal from './Modal'

/** 보드 목록의 가져오기: JSON 파일 선택 또는 공유 링크 붙여넣기 */
export default function ImportModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [link, setLink] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  function fail(e: unknown) {
    setError(e instanceof ImportError ? e.message : '가져오지 못했습니다. 다시 시도해 주세요.')
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    if (file.size > MAX_IMPORT_CHARS * 3) {
      setError('파일이 너무 큽니다')
      return
    }
    setBusy(true)
    try {
      setResult(parseImport(await file.text()))
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = '' // 같은 파일을 다시 고를 수 있게
    }
  }

  async function handleLink() {
    setError(null)
    const token = tokenFromText(link)
    if (!token) {
      setError('공유 링크를 붙여넣어 주세요')
      return
    }
    setBusy(true)
    try {
      setResult({ kind: 'board', board: await boardFromToken(token) })
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="가져오기" onClose={onClose}>
      {result ? (
        <ImportPreview
          result={result}
          onCancel={() => setResult(null)}
          onDone={(boardId) => {
            onClose()
            navigate(boardId ? `/board/${boardId}` : '/')
          }}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <section>
            <h3 className="mb-2 text-sm font-medium">파일에서 (보드 파일 / 백업 파일)</h3>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              aria-label="파일 선택"
              onChange={(e) => void handleFile(e.target.files?.[0])}
              className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-slate-200 file:px-4 file:font-medium"
            />
          </section>
          <section>
            <h3 className="mb-2 text-sm font-medium">공유 링크로</h3>
            <div className="flex gap-2">
              <input
                value={link}
                onChange={(e) => {
                  setLink(e.target.value)
                  setError(null)
                }}
                aria-label="공유 링크"
                placeholder="받은 링크를 붙여넣기"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base"
              />
              <button
                type="button"
                onClick={() => void handleLink()}
                disabled={busy}
                className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-50"
              >
                확인
              </button>
            </div>
          </section>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-slate-600">
              닫기
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
