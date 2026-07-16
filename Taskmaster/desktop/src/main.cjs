const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const {
  APP_ORIGIN,
  isCoreKnotAppReturn,
  shouldOpenAuthPopup,
  toAuthUrl,
} = require('./authNavigation.cjs');

const APP_URL = process.env.COREKNOT_DESKTOP_URL || 'https://tsccoreknot.com';
const isDev = !app.isPackaged;

autoUpdater.channel = 'beta';
autoUpdater.allowPrerelease = true;
autoUpdater.autoDownload = false;

let mainWindow;
let authWindow;
let updateInfo = null;
let updateDownloaded = false;

function sendUpdateStatus(status, detail = {}) {
  if (!mainWindow?.webContents) return;
  mainWindow.webContents.send('coreknot:update-status', {
    status,
    version: app.getVersion(),
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
    if (shouldOpenAuthPopup(url)) {
      openAuthPopup(url);
      return { action: 'deny' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!shouldOpenAuthPopup(url)) return;
    event.preventDefault();
    openAuthPopup(url);
  });
  mainWindow.webContents.on('did-navigate-in-page', (_event, url) => {
    if (!shouldOpenAuthPopup(url)) return;
    openAuthPopup(url);
    mainWindow.loadURL(APP_URL);
  });
}

function openAuthPopup(url) {
  const authUrl = toAuthUrl(url);
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.focus();
    authWindow.loadURL(authUrl);
    return;
  }

  authWindow = new BrowserWindow({
    width: 520,
    height: 760,
    minWidth: 420,
    minHeight: 620,
    title: 'Sign in to CoreKnot',
    parent: mainWindow || undefined,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const finishIfSignedIn = (nextUrl) => {
    if (!isCoreKnotAppReturn(nextUrl)) return;
    if (authWindow && !authWindow.isDestroyed()) authWindow.close();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(nextUrl || `${APP_ORIGIN}/dashboard`);
      mainWindow.focus();
    }
  };

  authWindow.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
    if (shouldOpenAuthPopup(nextUrl)) {
      authWindow.loadURL(toAuthUrl(nextUrl));
      return { action: 'deny' };
    }
    if (isCoreKnotAppReturn(nextUrl)) {
      finishIfSignedIn(nextUrl);
      return { action: 'deny' };
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        parent: authWindow,
        width: 520,
        height: 760,
        backgroundColor: '#0f172a',
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: false,
        },
      },
    };
  });
  authWindow.webContents.on('will-navigate', (event, nextUrl) => {
    if (!isCoreKnotAppReturn(nextUrl)) return;
    event.preventDefault();
    finishIfSignedIn(nextUrl);
  });
  authWindow.webContents.on('did-redirect-navigation', (_event, nextUrl) => {
    finishIfSignedIn(nextUrl);
  });
  authWindow.on('closed', () => {
    authWindow = null;
  });
  authWindow.loadURL(authUrl);
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'CoreKnot',
      submenu: [
        { label: `Version ${app.getVersion()}`, enabled: false },
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

autoUpdater.on('update-available', async (info) => {
  updateInfo = info;
  sendUpdateStatus('available', { releaseVersion: info.version });
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Download update', 'Later'],
    defaultId: 0,
    cancelId: 1,
    message: `CoreKnot Beta ${info.version} is available.`,
    detail: 'Download now and install after it finishes.',
  });
  if (choice.response === 0) {
    sendUpdateStatus('downloading', { releaseVersion: info.version });
    autoUpdater.downloadUpdate();
  }
});

autoUpdater.on('update-not-available', () => {
  sendUpdateStatus('current');
});

autoUpdater.on('download-progress', (progress) => {
  sendUpdateStatus('downloading', {
    percent: Math.round(progress.percent || 0),
    releaseVersion: updateInfo?.version,
  });
});

autoUpdater.on('update-downloaded', async (info) => {
  updateDownloaded = true;
  sendUpdateStatus('downloaded', { releaseVersion: info.version });
  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    buttons: ['Restart and install', 'Install on next launch'],
    defaultId: 0,
    cancelId: 1,
    message: `CoreKnot Beta ${info.version} is ready.`,
    detail: 'Restart CoreKnot to apply the update.',
  });
  if (choice.response === 0) autoUpdater.quitAndInstall();
});

autoUpdater.on('error', (error) => {
  sendUpdateStatus('error', { message: error.message });
});

ipcMain.handle('coreknot:get-desktop-info', () => ({
  version: app.getVersion(),
  channel: 'beta',
  appUrl: APP_URL,
  updateDownloaded,
  releaseVersion: updateInfo?.version || null,
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
