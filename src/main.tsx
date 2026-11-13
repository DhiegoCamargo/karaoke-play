import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const App = lazy(() => import('./App'))
const Guest = lazy(() => import('./Guest'))
const room = new URLSearchParams(window.location.search).get('sala')

createRoot(document.getElementById('root')!).render(
  <Suspense fallback={<p role="status">Carregando…</p>}>
    {room === null ? <App /> : <Guest room={room} />}
  </Suspense>,
)
