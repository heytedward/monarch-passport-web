import React from 'react'
import ReactDOM from 'react-dom/client'
import { ColorModeScript } from '@chakra-ui/react'
import App from './App.tsx'
import theme from './theme'
import './index.css'

// Dark-only app: Chakra persists the color mode in localStorage
// ('chakra-ui-color-mode'), and a stored value overrides initialColorMode.
// Devices that loaded the pre-fix build cached 'light' and render a white
// screen. Force the key to 'dark' at module load -- before ColorModeScript
// reads it -- so affected phones recover without clearing site data.
try {
  window.localStorage.setItem('chakra-ui-color-mode', 'dark')
} catch {
  /* localStorage unavailable (private mode/SSR) -- initialColorMode still applies */
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    <App />
  </React.StrictMode>
)
 