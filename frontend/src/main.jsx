import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const CONFIG_URL = 'https://raw.githubusercontent.com/kangrekt/Chatter/main/app-config.json';

const renderApp = () => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      {window.APP_CONFIG?.maintenance ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', background: 'var(--bg-color)', color: 'white', textAlign: 'center', padding: '20px' }}>
          <h2>{window.APP_CONFIG.maintenance_message || "Aplikasi Maintenance, Mohon sabar ya :)"}</h2>
        </div>
      ) : (
        <App />
      )}
    </StrictMode>
  );
};

fetch(CONFIG_URL + '?t=' + new Date().getTime())
  .then(res => {
    if (!res.ok) throw new Error("Config not found");
    return res.json();
  })
  .then(config => {
    window.APP_CONFIG = config;
    renderApp();
  })
  .catch(err => {
    console.warn("Gagal mengambil remote config, menggunakan fallback.", err);
    window.APP_CONFIG = {
      API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
      maintenance: false
    };
    renderApp();
  });
