import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { repository, type Board } from '../data'
import { boardFileName, boardJsonBlob, saveBoardFile } from '../lib/backup'
import { ImageTooLargeError, exportNodeToPng } from '../lib/exportImage'
import {
  canShareFiles,
  canShareText,
  copyText,
  downloadBlob,
  sanitizeFileName,
  shareViaSheet,
} from '../lib/files'
import { errorMessage } from '../lib/errors'
import { isMobileDevice } from '../lib/device'
import { buildShareLink, type ShareLink } from '../lib/shareLink'
import Modal from './Modal'

interface Props {
  board: Board
  /** 이미지로 저장할 화면 영역 (없으면 이미지 저장 불가) */
  getExportNode: () => HTMLElement | null
  /** 이미지 파일 이름에 붙일 기간 이름 */
  periodName: string
  onClose: () => void
}

type ImageState =
  | { status: 'preparing' }
  | { status: 'ready'; blob: Blob; file: File; previewUrl: string | null }
  | { status: 'error'; message: string }

type LinkState =
  | { status: 'loading' }
  | { status: 'ready'; link: ShareLink }
  | { status: 'error'; message: string }

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

const button = 'min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50'

export default function ShareModal({ board, getExportNode, periodName, onClose }: Props) {
  const navigate = useNavigate()
  const [image, setImage] = useState<ImageState>({ status: 'preparing' })
  const [linkState, setLinkState] = useState<LinkState>({ status: 'loading' })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const linkInput = useRef<HTMLInputElement>(null)

  const imageName = `${sanitizeFileName(`${board.name} ${periodName}`, 'ptoj')}.png`
  const jsonFile = useMemo(
    () => new File([boardJsonBlob(board)], boardFileName(board), { type: 'application/json' }),
    [board],
  )

  // 공유 시트는 눌렀을 때 바로 열어야 하므로(Safari) 이미지는 창을 열 때 미리 만들어 둔다
  useEffect(() => {
    let cancelled = false
    const node = getExportNode()
    if (!node) {
      setImage({ status: 'error', message: '이 기간에는 저장할 일정이 없습니다' })
      return
    }
    exportNodeToPng(node)
      .then(async (blob) => {
        const file = new File([blob], imageName, { type: 'image/png' })
        // 모바일인데 공유 화면을 쓸 수 없으면, 길게 눌러 저장할 수 있게 이미지를 화면에 보여 준다
        const previewUrl = isMobileDevice() && !canShareFiles([file]) ? await blobToDataUrl(blob) : null
        if (cancelled) return
        setImage({ status: 'ready', blob, file, previewUrl })
      })
      .catch((e) => {
        if (cancelled) return
        setImage({
          status: 'error',
          message:
            e instanceof ImageTooLargeError
              ? '기간이 길어 이미지로 만들 수 없습니다. 주 또는 월 보기로 바꿔 주세요.'
              : '이미지를 만들지 못했습니다. 다시 열어 주세요.',
        })
      })
    return () => {
      cancelled = true
    }
    // 창을 여는 시점의 화면만 저장하면 된다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    buildShareLink(board)
      .then((link) => !cancelled && setLinkState({ status: 'ready', link }))
      .catch((e) => {
        if (cancelled) return
        setLinkState({ status: 'error', message: e instanceof Error ? e.message : '링크를 만들지 못했습니다' })
      })
    return () => {
      cancelled = true
    }
  }, [board])

  async function guarded(action: () => Promise<void> | void) {
    setError(null)
    setMessage(null)
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const shareFiles = (file: File, title: string) =>
    guarded(async () => {
      const r = await shareViaSheet({ files: [file], title })
      if (r === 'shared') setMessage('공유했어요')
    })

  const link = linkState.status === 'ready' ? linkState.link : null

  return (
    <Modal title="공유" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <section aria-label="이미지">
          <h3 className="mb-1 text-sm font-semibold">이미지로 저장</h3>
          <p className="mb-2 text-xs text-slate-500">지금 보고 있는 기간({periodName})을 그림으로 저장해요.</p>
          {image.status === 'error' && (
            <p role="alert" className="text-sm text-red-600">{image.message}</p>
          )}
          {image.status === 'preparing' && <p className="text-sm text-slate-500">이미지 준비 중…</p>}
          {image.status === 'ready' && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {canShareFiles([image.file]) && (
                  <button
                    type="button"
                    onClick={() => void shareFiles(image.file, board.name)}
                    className={
                      isMobileDevice()
                        ? 'min-h-11 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white'
                        : button
                    }
                  >
                    {isMobileDevice() ? '사진에 저장하기' : '이미지 공유하기'}
                  </button>
                )}
                <button type="button" onClick={() => downloadBlob(image.blob, imageName)} className={button}>
                  이미지 파일로 저장
                </button>
              </div>
              {isMobileDevice() && canShareFiles([image.file]) && (
                <p className="text-xs text-slate-500">
                  열리는 화면에서 &quot;이미지 저장&quot;을 누르면 사진첩에 저장돼요. 카톡 등으로 바로 보낼 수도 있어요.
                </p>
              )}
              {image.previewUrl && (
                <div>
                  <p className="mb-1 text-xs text-slate-500">
                    아래 이미지를 길게 눌러 &quot;사진에 추가&quot;(iPhone) 또는 &quot;이미지 다운로드&quot;(Android)를 선택하면 사진첩에 저장돼요.
                  </p>
                  <img
                    src={image.previewUrl}
                    alt={`${board.name} ${periodName} 로드맵`}
                    className="max-h-80 w-full rounded-lg border border-slate-200 object-contain"
                  />
                </div>
              )}
            </div>
          )}
        </section>

        <section aria-label="링크">
          <h3 className="mb-1 text-sm font-semibold">공유 링크</h3>
          <p className="mb-2 text-xs text-slate-500">받은 사람이 열면 내 보드로 가져올 수 있어요. 보낸 시점의 내용이 전달돼요.</p>
          {linkState.status === 'loading' && <p className="text-sm text-slate-500">링크 만드는 중…</p>}
          {linkState.status === 'error' && (
            <p role="alert" className="text-sm text-red-600">{linkState.message}. 아래 JSON 파일로 공유해 주세요.</p>
          )}
          {link?.tooLong && (
            <p role="alert" className="text-sm text-red-600">
              카드가 많아 링크로 공유하기 어렵습니다 (링크 {link.length.toLocaleString()}자). 아래 JSON 파일을 사용해 주세요.
            </p>
          )}
          {link && !link.tooLong && (
            <div className="flex flex-col gap-2">
              <input
                ref={linkInput}
                readOnly
                value={link.url}
                aria-label="공유 링크 주소"
                onFocus={(e) => e.currentTarget.select()}
                className="w-full min-w-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void guarded(async () => {
                      if (await copyText(link.url)) setMessage('링크를 복사했어요')
                      else {
                        linkInput.current?.select()
                        setError('복사하지 못했습니다. 위 주소를 직접 복사해 주세요.')
                      }
                    })
                  }
                  className={button}
                >
                  링크 복사
                </button>
                {canShareText() && (
                  <button
                    type="button"
                    onClick={() =>
                      void guarded(async () => {
                        const r = await shareViaSheet({ title: board.name, url: link.url })
                        if (r === 'shared') setMessage('공유했어요')
                      })
                    }
                    className={button}
                  >
                    링크 공유하기
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <section aria-label="파일">
          <h3 className="mb-1 text-sm font-semibold">JSON 파일</h3>
          <p className="mb-2 text-xs text-slate-500">카드가 많아도 돼요. 받은 사람은 보드 목록의 &quot;가져오기&quot;에서 파일을 골라요.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void guarded(() => saveBoardFile(board))} className={button}>
              JSON 파일 저장
            </button>
            {canShareFiles([jsonFile]) && (
              <button type="button" onClick={() => void shareFiles(jsonFile, board.name)} className={button}>
                파일 공유하기
              </button>
            )}
          </div>
        </section>

        <section aria-label="복사">
          <button
            type="button"
            onClick={() =>
              void guarded(() => {
                const copy = repository.copyBoard(board.id)
                onClose()
                navigate(`/board/${copy.id}`)
              })
            }
            className={button}
          >
            보드 복사
          </button>
          <p className="mt-1 text-xs text-slate-500">카드를 복사한 새 보드를 만들어요 (완료 표시는 초기화).</p>
        </section>

        <p className="text-xs text-slate-500">
          링크와 파일에는 보드 내용이 그대로 들어 있어요. 서버에는 올라가지 않지만 메신저나 브라우저 기록에는 남을 수 있어요.
        </p>

        <div aria-live="polite">
          {message && <p className="text-sm text-emerald-700">{message}</p>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-slate-600">
            닫기
          </button>
        </div>
      </div>
    </Modal>
  )
}
