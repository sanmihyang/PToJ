import { useState, type FormEvent } from 'react'
import { LIMITS, NotFoundError, repository, type Card } from '../data'
import { validateCardForm, type CardFormErrors, type CardFormValues } from '../lib/cardForm'
import { errorMessage } from '../lib/errors'
import { mapLinks, searchQuery } from '../lib/mapLinks'
import ConfirmModal from './ConfirmModal'
import Modal from './Modal'

interface Props {
  boardId: string
  /** 있으면 수정 모드 */
  card?: Card
  defaultDate: string
  /** 저장된 카드의 날짜를 알려준다 (보고 있는 날짜 이동용) */
  onSaved: (date: string) => void
  onClose: () => void
}

const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-base'

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {error && (
        <span role="alert" className="text-red-600">
          {error}
        </span>
      )}
    </label>
  )
}

export default function CardFormModal({ boardId, card, defaultDate, onSaved, onClose }: Props) {
  const [values, setValues] = useState<CardFormValues>({
    title: card?.title ?? '',
    date: card?.date ?? defaultDate,
    startTime: card?.startTime ?? '',
    endTime: card?.endTime ?? '',
    content: card?.content ?? '',
    placeName: card?.placeName ?? '',
    address: card?.address ?? '',
  })
  const [errors, setErrors] = useState<CardFormErrors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [gone, setGone] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (key: keyof CardFormValues) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [key]: e.target.value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
    setSaveError(null)
  }

  function handleError(e: unknown) {
    setSaveError(errorMessage(e)) // 입력값은 유지한다
    if (e instanceof NotFoundError) setGone(true)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const found = validateCardForm(values)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }
    const fields = {
      title: values.title.trim(),
      content: values.content,
      date: values.date,
      startTime: values.startTime,
      endTime: values.endTime === '' ? null : values.endTime,
      placeName: values.placeName.trim() === '' ? null : values.placeName.trim(),
      address: values.address.trim() === '' ? null : values.address.trim(),
    }
    try {
      if (card) {
        repository.updateCard(boardId, card.id, fields)
      } else {
        repository.addCard(boardId, { ...fields, attendanceEnabled: false })
      }
      onSaved(values.date)
      onClose()
    } catch (err) {
      handleError(err)
    }
  }

  function handleDelete() {
    if (!card) return
    try {
      repository.deleteCard(boardId, card.id)
      onSaved(card.date)
      onClose()
    } catch (err) {
      setConfirmDelete(false)
      handleError(err)
    }
  }

  return (
    <>
      <Modal title={card ? '일정 수정' : '일정 추가'} onClose={onClose}>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
          <Field label="제목" error={errors.title}>
            <input
              autoFocus
              value={values.title}
              maxLength={LIMITS.cardTitle}
              onChange={set('title')}
              disabled={gone}
              className={inputClass}
              placeholder="예: 점심 식사"
            />
          </Field>
          <Field label="날짜" error={errors.date}>
            <input type="date" value={values.date} onChange={set('date')} disabled={gone} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="시작 시간" error={errors.startTime}>
              <input type="time" value={values.startTime} onChange={set('startTime')} disabled={gone} className={inputClass} />
            </Field>
            <Field label="종료 시간 (선택)">
              <input type="time" value={values.endTime} onChange={set('endTime')} disabled={gone} className={inputClass} />
            </Field>
          </div>
          {errors.endTime && (
            <p role="alert" className="-mt-2 text-sm text-red-600">
              {errors.endTime}
            </p>
          )}
          <Field label="위치 (선택)">
            <input
              value={values.placeName}
              maxLength={LIMITS.placeName}
              onChange={set('placeName')}
              disabled={gone}
              className={inputClass}
              placeholder="장소명 (예: 제주공항)"
            />
          </Field>
          <Field label="주소 (선택)">
            <input
              value={values.address}
              maxLength={LIMITS.address}
              onChange={set('address')}
              disabled={gone}
              className={inputClass}
              placeholder="지도는 주소로 검색해요 (예: 제주시 공항로 2)"
            />
          </Field>
          {searchQuery(values) !== '' && (
            <a
              href={mapLinks(values)[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="-mt-1 self-start rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              지도에서 확인 ↗
            </a>
          )}
          <Field label="내용 (선택)">
            <textarea
              value={values.content}
              maxLength={LIMITS.cardContent}
              onChange={set('content')}
              disabled={gone}
              rows={3}
              className={inputClass}
            />
          </Field>
          {saveError && (
            <p role="alert" className="text-sm text-red-600">
              {saveError}
            </p>
          )}
          <div className="flex items-center gap-2">
            {card && !gone && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg px-3 py-2 text-red-600"
              >
                삭제
              </button>
            )}
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-slate-600">
                {gone ? '닫기' : '취소'}
              </button>
              {!gone && (
                <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white">
                  저장
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>
      {confirmDelete && (
        <ConfirmModal
          title="일정 삭제"
          message={`'${card?.title}' 일정을 삭제할까요?`}
          confirmLabel="삭제"
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}
