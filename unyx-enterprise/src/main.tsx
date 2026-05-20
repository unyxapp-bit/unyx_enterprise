import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RootProviders } from '@/app/providers/RootProviders'
import './styles/globals.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootProviders>
      <App />
    </RootProviders>
  </StrictMode>,
)
