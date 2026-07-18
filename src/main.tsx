import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely suppress sandboxed environment network/fetch failures
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason && (
      reason.message?.includes('Failed to fetch') ||
      reason.message?.includes('fetch') ||
      reason.toString?.().includes('Failed to fetch') ||
      reason.toString?.().includes('fetch') ||
      reason.name === 'TypeError'
    )) {
      console.warn('Suppressing network-induced promise rejection:', reason);
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const message = event.message || '';
    if (message.includes('Failed to fetch') || message.includes('fetch') || message.includes('TypeError')) {
      console.warn('Suppressing network-induced error:', message);
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

// Register Service Worker
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered successfully with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('Service Worker registration failed:', error);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
