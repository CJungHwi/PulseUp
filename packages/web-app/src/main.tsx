import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// 콘솔/브라우저 로그(콘솔 출력) 비활성화
// - 현장 운영 시 콘솔 노이즈 제거 목적
// - 필요 시 디버깅할 때만 임시로 주석 해제
;(() => {
  const noop = () => {}
  try {
    console.log = noop
    console.warn = noop
    console.error = noop
    console.info = noop
    console.debug = noop
  } catch {
    // ignore
  }
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)