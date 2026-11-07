const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'INCHA Artisan Milk Tea - POS Kasir & Manajemen Outlet',
    icon: path.join(__dirname, '../public/incha-emblem.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// -------------------------------------------------------------
// IPC Handlers untuk Silent Thermal Printing (Bebas Disconnect)
// -------------------------------------------------------------

// 1. Dapatkan daftar seluruh printer Windows yang terpasang
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: p.isDefault,
      status: p.status,
    }));
  } catch (err) {
    console.error('Gagal mengambil daftar printer Windows:', err);
    return [];
  }
});

// 2. Cetak Struk Secara Silent (Tanpa Dialog / 0.1 Detik Langsung Keluar)
ipcMain.handle('print-silent', async (event, { deviceName, pageSize = '58mm' } = {}) => {
  if (!mainWindow) return { success: false, error: 'Window tidak aktif' };

  return new Promise((resolve) => {
    const printOptions = {
      silent: true,
      printBackground: true,
      deviceName: deviceName || '', // Jika kosong, gunakan default Windows printer
      color: false,
      margins: {
        marginType: 'none',
      },
      pageSize: pageSize === '80mm' ? { width: 80000, height: 297000 } : { width: 58000, height: 297000 },
    };

    mainWindow.webContents.print(printOptions, (success, failureReason) => {
      if (!success) {
        console.warn('Gagal cetak silent:', failureReason);
        resolve({ success: false, error: failureReason });
      } else {
        console.log('Struk berhasil dicetak silent ke printer:', deviceName || 'Default');
        resolve({ success: true });
      }
    });
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
