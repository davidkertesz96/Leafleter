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
}); 