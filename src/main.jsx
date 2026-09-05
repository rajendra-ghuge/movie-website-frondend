import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './styles/variables.css'
import './styles/base.css'
import './styles/navbar.css'
import './styles/home.css'
import './styles/detail.css'
import './styles/watch.css'
import './styles/downloads.css'
import './styles/mobile.css'
import './styles/tv-dpad.css'
import './styles/chatbot.css'
import App from './App.jsx'

// Disable TV Browser default spatial navigation & handle digit navigation
window.addEventListener('keydown', (e) => {
  // Prevent infinite loop from our own synthetic events
  if (!e.isTrusted) return;

  const el = document.activeElement;
  const isInput = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');

  // If typing in an input or textarea, let native browser typing and Enter submission happen
  if (isInput) {
    return;
  }

  const digitMap = {
    'Enter': 'Enter',
    'Ok': 'Enter',
    'OK': 'Enter',
    'Select': 'Enter',
    'Center': 'Enter',
    'DPadCenter': 'Enter',
    'ChannelUp': 'ArrowUp',
    'ChannelDown': 'ArrowDown',
    'PageUp': 'ArrowUp',
    'PageDown': 'ArrowDown'
  };

  if (digitMap[e.key]) {
    e.preventDefault();
    e.stopPropagation();

    const targetKey = digitMap[e.key];
    const keyCodes = {
      'ArrowLeft': 37, 'ArrowUp': 38, 'ArrowRight': 39, 'ArrowDown': 40, 'Enter': 13
    };

    const sendKey = (type) => {
      // If nothing is focused, jump focus to the first nav link
      // BUT: Don't do this if we are on the watch page, or we might steal focus from the player!
      const isWatchPage = window.location.pathname.includes('/watch/');
      if (!isWatchPage && (!document.activeElement || document.activeElement === document.body)) {
        const firstNav = document.querySelector('.nav-link');
        if (firstNav) firstNav.focus();
      }

      const ev = new KeyboardEvent(type, {
        key: targetKey,
        code: targetKey,
        keyCode: keyCodes[targetKey],
        which: keyCodes[targetKey],
        bubbles: true,
        cancelable: true,
        view: window
      });
      (document.activeElement || document).dispatchEvent(ev);

      // Explicitly trigger click for Enter keys to ensure buttons activate
      if (type === 'keydown' && targetKey === 'Enter') {
        const el = document.activeElement;
        if (el && el !== document.body) el.click();
      }
    };

    sendKey('keydown');
    setTimeout(() => sendKey('keyup'), 10);
    return;
  }

  const keys = [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter',
    'Up', 'Down', 'Left', 'Right', 'Select', 'Ok', 'OK', 'Center', 'DPadCenter'
  ];
  const isRemoteOk =
    e.key === 'Enter' ||
    e.key === 'Select' ||
    e.key === 'Ok' ||
    e.key === 'OK' ||
    e.key === 'Accept' ||
    e.key === 'Center' ||
    e.key === 'DPadCenter' ||
    e.keyCode === 13 ||
    e.keyCode === 23 ||
    (e.keyCode === 66 && e.key !== 'b' && e.key !== 'B') ||
    e.which === 13 ||
    e.which === 23 ||
    (e.which === 66 && e.key !== 'b' && e.key !== 'B');

  if (keys.includes(e.key) || isRemoteOk) {
    // We ONLY use preventDefault to stop the browser from scrolling.
    // We DO NOT use stopPropagation because the app needs to hear these keys!
    e.preventDefault(); 

    // Explicitly trigger click for Enter/Select/Ok keys to ensure buttons activate
    if (isRemoteOk) {
      const el = document.activeElement;
      if (el && el !== document.body) el.click();
    }
  }
}, { capture: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <SpeedInsights />
  </StrictMode>,
)
