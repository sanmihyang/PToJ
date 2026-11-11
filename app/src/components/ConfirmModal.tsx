import { useState } from 'react'
import { errorMessage } from '../lib/errors'
import Modal from './Modal'

interface Props {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmModal({ title, message, confirmLabel, onConfirm, onClose }: Props) {
  const [error, setError] = useState<string | null>(null)

  function handleConfirm() {
    try {
      onConfirm()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="mb-4 text-sm text-slate-700">{message}</p>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-slate-600">
          취소
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
