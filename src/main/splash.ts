import { BrowserWindow } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

let splash: BrowserWindow | null = null

function loadIconAsDataUrl(): string | null {
  // Try a few candidate paths for the bundled icon.png
  const candidates = [
    join(__dirname, '../../resources/icon.png'),
    join(process.resourcesPath || '', 'icon.png'),
    join(process.resourcesPath || '', 'resources/icon.png')
  ]
  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        return 'data:image/png;base64,' + readFileSync(p).toString('base64')
      }
    } catch {
      // try next
    }
  }
  return null
}

export function createSplash(): BrowserWindow {
  splash = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: { sandbox: false, contextIsolation: true }
  })

  const icon = loadIconAsDataUrl()
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap');
  html, body { margin: 0; padding: 0; height: 100%; width: 100%; background: transparent; overflow: hidden; }
  body {
    display: flex; align-items: center; justify-content: center;
    font-family: 'Cairo', 'Tahoma', sans-serif;
    -webkit-font-smoothing: antialiased;
    user-select: none; -webkit-user-select: none;
  }
  .card {
    background: linear-gradient(135deg, #163E3C 0%, #226A66 60%, #2F857F 100%);
    border-radius: 28px;
    padding: 36px 28px;
    width: 360px; height: 240px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
    color: #FBF8F3;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center;
    animation: fadein .35s ease-out;
  }
  @keyframes fadein { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
  .icon {
    width: 92px; height: 92px;
    margin-bottom: 18px;
    border-radius: 22px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.25);
    display: block;
    background: rgba(255,255,255,0.06);
    object-fit: contain;
  }
  h1 { font-size: 18px; font-weight: 800; margin: 0 0 4px; }
  .sub { font-size: 12px; opacity: 0.7; margin-bottom: 18px; }
  .dots { display: inline-flex; gap: 6px; }
  .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #E8B85C; opacity: 0.4;
    animation: pulse 1.2s infinite ease-in-out;
  }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes pulse {
    0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
    40% { opacity: 1; transform: scale(1.1); }
  }
</style>
</head>
<body>
  <div class="card">
    ${icon ? `<img class="icon" src="${icon}" alt="logo">` : `<div class="icon" style="display:flex;align-items:center;justify-content:center;font-size:40px">📷</div>`}
    <h1>نظام إدارة مبيعات الاستوديو</h1>
    <div class="sub">جارٍ التحميل...</div>
    <div class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
  </div>
</body>
</html>`
  splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  splash.once('ready-to-show', () => splash?.show())
  return splash
}

export function closeSplash(): void {
  if (splash && !splash.isDestroyed()) {
    splash.close()
  }
  splash = null
}
