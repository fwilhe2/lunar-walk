const { app, BrowserWindow, net, protocol } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// The app is the Vite build in dist/ (bun run build). It is served over
// app:// rather than loaded from file://, so ES modules and module
// workers behave exactly as they do from a web server.
const DIST = path.join(__dirname, '..', 'dist');
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// LW_SMOKE=1: open hidden, report page errors, quit after a while —
// a check that the packaged build boots, without a window in the way.
const SMOKE = !!process.env.LW_SMOKE;

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: !SMOKE,
    backgroundColor: '#000000',
    title: 'Lunar Walk',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (SMOKE) {
    let errors = 0;
    window.webContents.on('console-message', (e) => {
      if (e.level === 'error' || e.level === 'warning') { errors += e.level === 'error'; console.log(e.level, e.message); }
    });
    window.webContents.on('render-process-gone', (e, d) => { console.log('gone', d.reason); app.exit(1); });
    setTimeout(async () => {
      const booted = await window.webContents.executeJavaScript("document.getElementById('boot').hidden");
      console.log('booted:', booted, 'errors:', errors);
      app.exit(booted && !errors ? 0 : 1);
    }, +process.env.LW_SMOKE * 1000 || 20000);
  }
  window.loadURL('app://lunar-walk/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const file = path.normalize(path.join(DIST, decodeURIComponent(new URL(request.url).pathname)));
    if (!file.startsWith(DIST + path.sep)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
