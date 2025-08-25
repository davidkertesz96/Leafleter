const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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

ipcMain.handle('db:addStreet', async (_evt, street) => {
  const normalized = {
    name: String(street.name || '').trim(),
    municipality: String(street.municipality || '').trim(),
    start: street.start === '' || street.start === undefined || street.start === null ? null : Number(street.start),
    end: street.end === '' || street.end === undefined || street.end === null ? null : Number(street.end),
    interval: street.interval === 'even' || street.interval === 'odd' ? street.interval : 'all',
  };
  if (!normalized.name || !normalized.municipality) {
    throw new Error('Street name and municipality are required');
  }
  const id = db.upsertStreet(normalized);
  return { id };
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

// IPC: Street-level notes
ipcMain.handle('db:listStreetNotes', async (_evt, streetId) => {
  return db.listStreetNotes(streetId);
});

ipcMain.handle('db:addStreetNote', async (_evt, streetId, text) => {
  const id = db.addStreetNote(streetId, text);
  return { id };
});

ipcMain.handle('db:deleteStreetNote', async (_evt, noteId) => {
  db.deleteStreetNote(noteId);
  return true;
});

// IPC: Sectors
ipcMain.handle('db:listSectors', async () => {
  return db.listSectors();
});

ipcMain.handle('db:addSector', async (_evt, name, note, color) => {
  const id = db.addSector(name, note, color);
  return { id };
});

ipcMain.handle('db:deleteSector', async (_evt, sectorId) => {
  db.deleteSector(sectorId);
  return true;
});

ipcMain.handle('db:assignSector', async (_evt, streetId, sectorIdOrNull) => {
  db.assignSector(streetId, sectorIdOrNull || null);
  return true;
});

ipcMain.handle('db:getStreetSector', async (_evt, streetId) => {
  return db.getStreetSector(streetId);
});

// IPC: Export/Import
ipcMain.handle('db:export', async (evt) => {
  const win = BrowserWindow.fromWebContents(evt.sender);
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export database',
    defaultPath: 'leafleter-export.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false };
  const raw = db.getRawDb();
  const fs = require('fs');
  fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf8');
  return { ok: true, filePath };
});

ipcMain.handle('db:import', async (evt) => {
  const win = BrowserWindow.fromWebContents(evt.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import database',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths || filePaths.length === 0) return { ok: false };
  const fs = require('fs');
  const content = fs.readFileSync(filePaths[0], 'utf8');
  const obj = JSON.parse(content);
  await db.replaceDb(obj);
  return { ok: true };
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