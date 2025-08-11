const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./db');

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

// IPC: Streets and municipalities
ipcMain.handle('db:seedStreets', async (_evt, streets) => {
  for (const s of streets) {
    db.upsertStreet(s);
  }
  return true;
});

ipcMain.handle('db:listStreetsGrouped', async () => {
  return db.listMunicipalitiesWithStreets();
});

ipcMain.handle('db:setHouseNumbers', async (_evt, streetId, numbers) => {
  db.setHouseNumbers(streetId, numbers);
  return true;
});

ipcMain.handle('db:listHouseNumbers', async (_evt, streetId) => {
  return db.listHouseNumbers(streetId);
});

// IPC: Notes
ipcMain.handle('db:listNotes', async (_evt, streetId, number) => {
  return db.listNotes(streetId, number);
});

ipcMain.handle('db:addNote', async (_evt, streetId, number, text) => {
  const id = db.addNote(streetId, number, text);
  return { id };
});

ipcMain.handle('db:deleteNote', async (_evt, noteId) => {
  db.deleteNote(noteId);
  return true;
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 