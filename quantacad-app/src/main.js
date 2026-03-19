const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let isDev = process.argv.includes('--dev');

// ── CREATE MAIN WINDOW ──────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    frame: false,           // custom titlebar
    backgroundColor: '#0d0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../build/icon.png'),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── APP MENU ────────────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('menu', 'new-project') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', click: () => openProject() },
        { label: 'Save Project', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu', 'save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow.webContents.send('menu', 'save-as') },
        { type: 'separator' },
        { label: 'Import Drawing (DWG/DXF/PDF)…', accelerator: 'CmdOrCtrl+I', click: () => importDrawing() },
        { type: 'separator' },
        { label: 'Export Cost Report (PDF)…', accelerator: 'CmdOrCtrl+E', click: () => mainWindow.webContents.send('menu', 'export-pdf') },
        { label: 'Export Takeoff (Excel)…', click: () => mainWindow.webContents.send('menu', 'export-xlsx') },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow.webContents.send('menu', 'undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => mainWindow.webContents.send('menu', 'redo') },
        { type: 'separator' },
        { label: 'Delete Selected', accelerator: 'Delete', click: () => mainWindow.webContents.send('menu', 'delete') },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', click: () => mainWindow.webContents.send('menu', 'select-all') },
        { type: 'separator' },
        { label: 'Project Settings…', click: () => mainWindow.webContents.send('menu', 'settings') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => mainWindow.webContents.send('menu', 'zoom-in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => mainWindow.webContents.send('menu', 'zoom-out') },
        { label: 'Fit Drawing', accelerator: 'CmdOrCtrl+0', click: () => mainWindow.webContents.send('menu', 'fit') },
        { type: 'separator' },
        { label: 'Toggle Grid Snap', accelerator: 'G', click: () => mainWindow.webContents.send('menu', 'snap-grid') },
        { label: 'Toggle Angle Snap', accelerator: 'A', click: () => mainWindow.webContents.send('menu', 'snap-angle') },
        { type: 'separator' },
        ...(isDev ? [{ role: 'toggleDevTools' }, { type: 'separator' }] : []),
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Measure',
      submenu: [
        { label: 'Select Tool', accelerator: 'Escape', click: () => mainWindow.webContents.send('menu', 'tool-select') },
        { label: 'Length', accelerator: 'L', click: () => mainWindow.webContents.send('menu', 'tool-length') },
        { label: 'Area', accelerator: 'R', click: () => mainWindow.webContents.send('menu', 'tool-area') },
        { label: 'Count', accelerator: 'C', click: () => mainWindow.webContents.send('menu', 'tool-count') },
        { label: 'Volume', accelerator: 'V', click: () => mainWindow.webContents.send('menu', 'tool-volume') },
        { type: 'separator' },
        { label: 'Calibrate Scale…', accelerator: 'K', click: () => mainWindow.webContents.send('menu', 'calibrate') },
      ],
    },
    {
      label: 'Reports',
      submenu: [
        { label: 'Cost Summary', click: () => mainWindow.webContents.send('menu', 'report-cost') },
        { label: 'Quantity Takeoff', click: () => mainWindow.webContents.send('menu', 'report-qty') },
        { label: 'Material Schedule', click: () => mainWindow.webContents.send('menu', 'report-material') },
        { label: 'Trade Breakdown', click: () => mainWindow.webContents.send('menu', 'report-trade') },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Getting Started', click: () => mainWindow.webContents.send('menu', 'help') },
        { label: 'Keyboard Shortcuts', accelerator: 'CmdOrCtrl+/', click: () => mainWindow.webContents.send('menu', 'shortcuts') },
        { type: 'separator' },
        { label: 'About QuantaCAD', click: () => showAbout() },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC HANDLERS ────────────────────────────────────────────────────────────
ipcMain.handle('window-minimize', () => mainWindow?.minimize());
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window-close', () => mainWindow?.close());
ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized() ?? false);

ipcMain.handle('import-drawing', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Drawing',
    filters: [
      { name: 'Drawing Files', extensions: ['pdf', 'dwg', 'dxf', 'png', 'jpg', 'jpeg', 'tiff'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile', 'multiSelections'],
  });
  if (!filePaths.length) return null;
  const files = filePaths.map(p => ({
    path: p,
    name: path.basename(p),
    ext: path.extname(p).toLowerCase(),
    size: fs.statSync(p).size,
  }));
  return files;
});

ipcMain.handle('save-project', async (_, data) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Project',
    defaultPath: `${data.projectName || 'project'}.qcad`,
    filters: [{ name: 'QuantaCAD Project', extensions: ['qcad'] }],
  });
  if (!filePath) return false;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
});

ipcMain.handle('open-project', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Project',
    filters: [{ name: 'QuantaCAD Project', extensions: ['qcad'] }],
    properties: ['openFile'],
  });
  if (!filePaths.length) return null;
  const raw = fs.readFileSync(filePaths[0], 'utf8');
  return JSON.parse(raw);
});

ipcMain.handle('export-report', async (_, { type, content }) => {
  const ext = type === 'pdf' ? 'pdf' : 'csv';
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Report',
    defaultPath: `QuantaCAD_Report.${ext}`,
    filters: [{ name: type.toUpperCase(), extensions: [ext] }],
  });
  if (!filePath) return false;
  fs.writeFileSync(filePath, content, 'utf8');
  shell.showItemInFolder(filePath);
  return filePath;
});

ipcMain.handle('show-message', async (_, opts) => dialog.showMessageBox(mainWindow, opts));

// ── HELPERS ─────────────────────────────────────────────────────────────────
async function openProject() {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'QuantaCAD Project', extensions: ['qcad'] }],
    properties: ['openFile'],
  });
  if (filePaths.length) {
    const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
    mainWindow.webContents.send('load-project', data);
  }
}

async function importDrawing() {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Drawing',
    filters: [{ name: 'Drawing Files', extensions: ['pdf', 'dwg', 'dxf', 'png', 'jpg', 'jpeg'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (filePaths.length) {
    mainWindow.webContents.send('import-files', filePaths.map(p => ({
      path: p, name: path.basename(p), ext: path.extname(p).toLowerCase(),
    })));
  }
}

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About QuantaCAD',
    message: 'QuantaCAD v1.0.0',
    detail: 'AutoCAD SAP — Quantity Takeoff & Cost Estimating\nBuilt with Electron\n\n© 2024 QuantaCAD. All rights reserved.',
    buttons: ['OK'],
    icon: path.join(__dirname, '../build/icon.png'),
  });
}

// ── STARTUP ──────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
