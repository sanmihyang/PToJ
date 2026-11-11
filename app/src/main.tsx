import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { repository, requestPersistence } from './data'
import './index.css'

void requestPersistence()

// 개발 서버에서만: 콘솔에서 window.ptoj.repository 로 저장소를 직접 확인할 수 있다
if (import.meta.env.DEV) {
  ;(window as unknown as { ptoj: unknown }).ptoj = { repository }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
