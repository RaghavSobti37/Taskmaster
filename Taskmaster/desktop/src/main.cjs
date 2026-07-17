const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');

const APP_URL = process.env.COREKNOT_DESKTOP_URL || 'https://tsccoreknot.com';
const isDev = !app.isPackaged;
const AUTH_PATH_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/google/success',
];

autoUpdater.channel = 'beta';
autoUpdater.allowPrerelease = true;
autoUpdater.autoDownload = false;

let mainWindow;
let updateDownloaded = false;

function isAuthNavigation(url) {
  try {
    const target = new URL(url);
    const appUrl = new URL(APP_URL);
    const isAuthHost = target.hostname === 'auth.tsccoreknot.com';
    const isAppAuthPath =
      target.origin === appUrl.origin &&
      AUTH_PATH_PREFIXES.some((path) => target.pathname === path || target.pathname.startsWith(`${path}/`));
    return isAuthHost || isAppAuthPath;
  } catch {
    return false;
  }
}

function openInDefaultBrowser(url) {
  shell.openExternal(url);
}

function sendUpdateStatus(status, detail = {}) {
  if (!mainWindow?.webContents) return;
  mainWindow.webContents.send('coreknot:update-status', {
    status,
    ...detail,
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: 'CoreKnot Beta',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: `${__dirname}/preload.cjs`,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(APP_URL);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openInDefaultBrowser(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAuthNavigation(url)) return;
    event.preventDefault();
    openInDefaultBrowser(url);
  });
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'CoreKnot',
      submenu: [
        { label: 'CoreKnot Beta', enabled: false },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => checkForUpdates(true),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]);
}

async function checkForUpdates(manual = false) {
  if (isDev) {
    sendUpdateStatus('disabled-dev');
    if (manual) dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: 'Updates are available in packaged beta builds.',
    });
    return;
  }

  try {
    sendUpdateStatus('checking');
    const result = await autoUpdater.checkForUpdates();
    if (!result?.updateInfo && manual) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        message: 'CoreKnot Beta is up to date.',
      });
    }
  } catch (error) {
    sendUpdateStatus('error', { message: error.message });
    if (manual) dialog.showMessageBox(mainWindow, {
      type: 'warning',
      message: 'Could not check for updates.',
      detail: error.message,
    });
  }
}

autoUpdater.on('update-available', async () => {
  sendUpdateStatus('available');
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Download update', 'Later'],
    defaultId: 0,
    cancelId: 1,
    message: 'CoreKnot Beta update is available.',
    detail: 'Download now and install after it finishes.',
  });
  if (choice.response === 0) {
    sendUpdateStatus('downloading');
    autoUpdater.downloadUpdate();
  }
});

autoUpdater.on('update-not-available', () => {
  sendUpdateStatus('current');
});

autoUpdater.on('download-progress', (progress) => {
  sendUpdateStatus('downloading', {
    percent: Math.round(progress.percent || 0),
  });
});

autoUpdater.on('update-downloaded', async () => {
  updateDownloaded = true;
  sendUpdateStatus('downloaded');
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Restart and install', 'Install on next launch'],
    defaultId: 0,
    cancelId: 1,
    message: 'CoreKnot Beta update is ready.',
    detail: 'Restart CoreKnot to apply the update.',
  });
  if (choice.response === 0) autoUpdater.quitAndInstall();
});

autoUpdater.on('error', (error) => {
  sendUpdateStatus('error', { message: error.message });
});

ipcMain.handle('coreknot:get-desktop-info', () => ({
  channel: 'beta',
  appUrl: APP_URL,
  updateDownloaded,
}));

ipcMain.handle('coreknot:check-for-updates', () => checkForUpdates(true));

app.whenReady().then(() => {
  Menu.setApplicationMenu(buildMenu());
  createWindow();
  setTimeout(() => checkForUpdates(false), 5000);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
