import { Route, Routes } from 'react-router-dom'
import StorageNotice from './components/StorageNotice'

function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-bold">P를 위한 J</h1>
      <p className="text-slate-600">최소한의 노력으로 세우는 일정 로드맵</p>
      <p className="rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-700">
        2단계: 데이터 저장소 (화면 변경 없음)
      </p>
    </main>
  )
}

export default function App() {
  return (
    <>
      <StorageNotice />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </>
  )
}
