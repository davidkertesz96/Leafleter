const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  seedStreets: (streets) => ipcRenderer.invoke('db:seedStreets', streets),
  addStreet: (street) => ipcRenderer.invoke('db:addStreet', street),
  listStreetsGrouped: () => ipcRenderer.invoke('db:listStreetsGrouped'),
  setHouseNumbers: (streetId, numbers) => ipcRenderer.invoke('db:setHouseNumbers', streetId, numbers),
  listHouseNumbers: (streetId) => ipcRenderer.invoke('db:listHouseNumbers', streetId),
  listNotes: (streetId, number) => ipcRenderer.invoke('db:listNotes', streetId, number),
  addNote: (streetId, number, text) => ipcRenderer.invoke('db:addNote', streetId, number, text),
  deleteNote: (noteId) => ipcRenderer.invoke('db:deleteNote', noteId),
  exportDb: () => ipcRenderer.invoke('db:export'),
  importDb: () => ipcRenderer.invoke('db:import'),
  // street-level notes
  listStreetNotes: (streetId) => ipcRenderer.invoke('db:listStreetNotes', streetId),
  addStreetNote: (streetId, text) => ipcRenderer.invoke('db:addStreetNote', streetId, text),
  deleteStreetNote: (noteId) => ipcRenderer.invoke('db:deleteStreetNote', noteId),
  // sectors
  listSectors: () => ipcRenderer.invoke('db:listSectors'),
  addSector: (name, note, color) => ipcRenderer.invoke('db:addSector', name, note, color),
  deleteSector: (sectorId) => ipcRenderer.invoke('db:deleteSector', sectorId),
  assignSector: (streetId, sectorIdOrNull) => ipcRenderer.invoke('db:assignSector', streetId, sectorIdOrNull),
  getStreetSector: (streetId) => ipcRenderer.invoke('db:getStreetSector', streetId),
}); 