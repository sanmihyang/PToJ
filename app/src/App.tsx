import { Route, Routes } from 'react-router-dom'
import StorageNotice from './components/StorageNotice'
import BoardListPage from './pages/BoardListPage'
import BoardPage from './pages/BoardPage'

export default function App() {
  return (
    <>
      <StorageNotice />
      <Routes>
        <Route path="/" element={<BoardListPage />} />
        <Route path="/board/:id" element={<BoardPage />} />
        <Route path="*" element={<BoardListPage />} />
      </Routes>
    </>
  )
}
