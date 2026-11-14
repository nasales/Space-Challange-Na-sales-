// Dev preview of the featured case levels, served at /levels.html (npm run dev).
// Separate from the game: it does not load App.tsx.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PreviewApp from './PreviewApp'
import './theme.css'
import './preview.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreviewApp />
  </StrictMode>,
)
