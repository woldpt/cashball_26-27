import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import './index.css'
import App from './App.jsx'

// Registo do service worker (PWA / offline). URL versionado (ver topo do
// sw.vN.js): renomear o ficheiro a cada mudança para furar caches velhas.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.v10.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Respeita prefers-reduced-motion: animações de transform viram fade/opacidade. */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
)
