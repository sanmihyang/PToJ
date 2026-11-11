import { useState, type FormEvent } from 'react'
import { LIMITS } from '../data'
import { errorMessage } from '../lib/errors'
import Modal from './Modal'

interface Props {
  title: string
  submitLabel: string
  initialName?: string
  onSubmit: (name: string) => void
  onClose: () => void
}

export default function BoardFormModal({
  title,
  submitLabel,
  initialName = '',
  onSubmit,
  onClose,
}: Props) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('보드 이름을 입력해 주세요')
      return
    }
    try {
      onSubmit(trimmed)
    } catch (err) {
      setError(errorMessage(err)) // 입력값은 유지한다
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">보드 이름</span>
          <input
            autoFocus
            value={name}
            maxLength={LIMITS.boardName}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-base"
            placeholder="예: 제주 여행"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-slate-600">
            취소
          </button>
          <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white">
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
