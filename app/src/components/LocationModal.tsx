import type { Card } from '../data'
import { mapLinks } from '../lib/mapLinks'
import Modal from './Modal'

interface Props {
  card: Card
  onClose: () => void
}

/** 위치 미리보기: 장소명/주소와 지도 앱 바로가기 (모바일 하단 시트 / PC 중앙 팝업) */
export default function LocationModal({ card, onClose }: Props) {
  const links = mapLinks(card)
  return (
    <Modal title="위치" onClose={onClose}>
      <div className="mb-4">
        {card.placeName && <p className="text-lg font-semibold break-words">{card.placeName}</p>}
        {card.address && <p className="mt-1 text-sm break-words text-slate-600">{card.address}</p>}
      </div>
      <p className="mb-2 text-sm font-medium">지도 앱에서 열기</p>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-between rounded-lg border border-slate-300 px-4 py-3 font-medium hover:bg-slate-50"
            >
              {link.label}
              <span aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-slate-600">
          닫기
        </button>
      </div>
    </Modal>
  )
}
