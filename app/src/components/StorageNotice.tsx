import { useState } from 'react'
import { getCorruptBackup, isPersistent, repository } from '../data'

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** 저장소 문제(사용 불가/손상 복구)를 알리는 배너 */
export default function StorageNotice() {
  const [closed, setClosed] = useState(false)
  if (closed) return null

  const recovered = repository.initial.status === 'recovered'
  if (isPersistent && !recovered) return null

  return (
    <div role="alert" className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="mx-auto flex max-w-md flex-col gap-2">
        {!isPersistent ? (
          <p>저장소를 사용할 수 없어 이번 접속 동안만 데이터가 유지됩니다. (사생활 보호 모드 등)</p>
        ) : (
          <p>저장된 데이터가 손상되어 빈 상태로 시작했습니다. 원본은 따로 보관되어 있습니다.</p>
        )}
        <div className="flex gap-2">
          {recovered && getCorruptBackup() && (
            <button
              type="button"
              className="rounded border border-amber-400 bg-white px-3 py-1"
              onClick={() => downloadText('ptoj-corrupt-backup.json', getCorruptBackup() ?? '')}
            >
              원본 내려받기
            </button>
          )}
          <button
            type="button"
            className="rounded border border-amber-400 bg-white px-3 py-1"
            onClick={() => setClosed(true)}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
