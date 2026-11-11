import { useState } from 'react'
import { useAppData } from '../hooks/useAppData'
import { saveBackup } from '../lib/backup'
import { needsBackup, readMeta, writeMeta } from '../lib/meta'

/** 마지막 백업 후 변경이 있고 7일이 지나면 백업을 권한다 */
export default function BackupNotice() {
  const data = useAppData()
  const [meta, setMeta] = useState(() => readMeta())

  if (!needsBackup(data.boards, meta)) return null

  return (
    <div role="status" className="mb-4 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-900">
      <p>
        보드는 이 기기의 브라우저에만 저장돼요. 브라우저가 데이터를 지우면 사라질 수 있으니 백업 파일을 저장해 두세요.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => {
            saveBackup(data)
            setMeta(readMeta())
          }}
          className="min-h-10 rounded-lg bg-sky-700 px-4 font-medium text-white"
        >
          백업 저장
        </button>
        <button
          type="button"
          onClick={() => {
            writeMeta({ backupNoticeDismissedAt: new Date().toISOString() })
            setMeta(readMeta())
          }}
          className="min-h-10 rounded-lg px-4 text-sky-800"
        >
          나중에
        </button>
      </div>
    </div>
  )
}
