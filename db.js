const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

const baseDir = (() => {
  try {
    return app.getPath('userData');
  } catch {
    return process.cwd();
  }
})();

const dataDir = path.join(baseDir, 'data');
const dbFile = path.join(dataDir, 'leafleter.json');

function ensureDirs() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function hashId(input) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function defaultDb() {
  return { streets: [], houseNumbers: {}, notes: [] };
}

function readDb() {
  ensureDirs();
  if (!fs.existsSync(dbFile)) {
    const init = defaultDb();
    fs.writeFileSync(dbFile, JSON.stringify(init, null, 2));
    return init;
  }
  const raw = fs.readFileSync(dbFile, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.streets) parsed.streets = [];
    if (!parsed.houseNumbers) parsed.houseNumbers = {};
    if (!parsed.notes) parsed.notes = [];
    return parsed;
  } catch {
    const init = defaultDb();
    fs.writeFileSync(dbFile, JSON.stringify(init, null, 2));
    return init;
  }
}

async function writeDb(db) {
  ensureDirs();
  await fsp.writeFile(dbFile, JSON.stringify(db, null, 2), 'utf8');
}

function validateAndNormalizeDb(obj) {
  if (typeof obj !== 'object' || obj === null) throw new Error('Invalid DB format');
  const clone = { streets: [], houseNumbers: {}, notes: [] };
  const streets = Array.isArray(obj.streets) ? obj.streets : [];
  for (const s of streets) {
    if (!s || typeof s !== 'object') continue;
    const name = String(s.name || '').trim();
    const municipality = String(s.municipality || '').trim();
    const start = s.start === null || s.start === undefined || s.start === '' ? null : Number(s.start);
    const end = s.end === null || s.end === undefined || s.end === '' ? null : Number(s.end);
    const interval = ['all', 'even', 'odd'].includes(s.interval) ? s.interval : 'all';
    if (!name || !municipality) continue;
    const id = String(s.id || '').trim() || hashId(`${municipality}|${name}|${start ?? ''}|${end ?? ''}|${interval}`);
    clone.streets.push({ id, name, municipality, start, end, interval });
  }
  const hn = obj.houseNumbers && typeof obj.houseNumbers === 'object' ? obj.houseNumbers : {};
  for (const [k, v] of Object.entries(hn)) {
    const arr = Array.isArray(v) ? v : [];
    clone.houseNumbers[k] = Array.from(new Set(arr.map(Number).filter(n => Number.isInteger(n)))).sort((a, b) => a - b);
  }
  const notes = Array.isArray(obj.notes) ? obj.notes : [];
  for (const n of notes) {
    if (!n || typeof n !== 'object') continue;
    const id = String(n.id || '').trim() || hashId(`${n.streetId}|${n.number}|${n.text}|${n.created_at || ''}`);
    const streetId = String(n.streetId || '').trim();
    const number = Number(n.number);
    const text = String(n.text || '').trim();
    const created_at = n.created_at ? new Date(n.created_at).toISOString() : new Date().toISOString();
    if (!streetId || !Number.isInteger(number) || !text) continue;
    clone.notes.push({ id, streetId, number, text, created_at });
  }
  return clone;
}

function getRawDb() {
  return readDb();
}

async function replaceDb(rawObj) {
  const normalized = validateAndNormalizeDb(rawObj);
  await writeDb(normalized);
  return true;
}

function streetKey(s) {
  return `${s.municipality}|${s.name}|${s.start ?? ''}|${s.end ?? ''}|${s.interval ?? 'all'}`;
}

function upsertStreet({ name, municipality, start = null, end = null, interval = 'all' }) {
  const db = readDb();
  const key = streetKey({ name, municipality, start, end, interval });
  const id = hashId(key);
  const existingIdx = db.streets.findIndex(x => x.id === id);
  const street = { id, name, municipality, start, end, interval };
  if (existingIdx === -1) {
    db.streets.push(street);
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
  }
  return id;
}

function listMunicipalitiesWithStreets() {
  const db = readDb();
  const grouped = {};
  for (const s of db.streets) {
    if (!grouped[s.municipality]) grouped[s.municipality] = [];
    grouped[s.municipality].push({
      id: s.id,
      name: s.name,
      start: s.start,
      end: s.end,
      interval: s.interval,
      municipality: s.municipality,
    });
  }
  for (const muni of Object.keys(grouped)) {
    grouped[muni].sort((a, b) => a.name.localeCompare(b.name));
  }
  return grouped;
}

function setHouseNumbers(streetId, numbers) {
  const db = readDb();
  db.houseNumbers[streetId] = Array.from(new Set(numbers)).sort((a, b) => a - b);
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

function listHouseNumbers(streetId) {
  const db = readDb();
  return db.houseNumbers[streetId] || [];
}

function listNotes(streetId, number) {
  const db = readDb();
  return db.notes.filter(n => n.streetId === streetId && n.number === number);
}

function addNote(streetId, number, text) {
  const db = readDb();
  const id = hashId(`${streetId}|${number}|${text}|${Date.now()}`);
  db.notes.push({ id, streetId, number, text, created_at: new Date().toISOString() });
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
  return id;
}

function deleteNote(noteId) {
  const db = readDb();
  const before = db.notes.length;
  db.notes = db.notes.filter(n => n.id !== noteId);
  if (db.notes.length !== before) {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
  }
}

module.exports = {
  // raw access
  getRawDb,
  replaceDb,
  // streets / numbers / notes
  upsertStreet,
  listMunicipalitiesWithStreets,
  setHouseNumbers,
  listHouseNumbers,
  listNotes,
  addNote,
  deleteNote,
}; 