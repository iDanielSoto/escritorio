import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import Logger from './utils/logger.js'

// Sustituir toda la consola de forma global para silenciar la app
// Redirigir console.error directamente a Logger.error para registrar en archivo
console.log = Logger.log;
console.info = Logger.info;
console.warn = Logger.warn;
console.debug = Logger.log;

const originalConsoleError = console.error;
console.error = (...args) => {
  Logger.error(...args);
  // Opcional: si la terminal estricta necesita ocultar incluso rojo en dev:
  // originalConsoleError(...args) <- Comentado para estricto "quitar a consola"
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
