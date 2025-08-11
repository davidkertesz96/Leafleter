const initialStreets = [
  { name: "Áchim utca", start: 1, end: null, interval: "all", municipality: "Miskolc" },
  { name: "Ács utca", start: 1, end: null, interval: "all", municipality: "Miskolc" },
  { name: "Adler Károly utca", start: 1, end: null, interval: "all", municipality: "Miskolc" },
  { name: "Ady Endre utca", start: 1, end: 9, interval: "all", municipality: "Miskolc" },
  { name: "Ady Endre utca", start: 14, end: null, interval: "all", municipality: "Miskolc" },
  { name: "Áfonyás utca", start: 1, end: null, interval: "odd", municipality: "Miskolc" },
];

const map = L.map('map').setView([48.104, 20.791], 13); // Default center 48.10431500688287, 20.791225448873913

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Track currently selected marker
let selectedMarker = null;

// Geocode cache
const geocodeCache = {};

// Additional cache for address-level geocoding
const addressGeocodeCache = {};

// Overpass API cache
const houseNumberCache = {};

// Geocode function using Nominatim
async function geocodeStreet(street, municipality) {
  const key = `${street},${municipality}`;
  if (geocodeCache[key]) {
    return geocodeCache[key];
  }
  const url = `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(street)}&city=${encodeURIComponent(municipality)}&format=json&limit=1`;
  const response = await fetch(url, { headers: { 'Accept-Language': 'en' }, method: 'GET' });
  const data = await response.json();
  if (data && data.length > 0) {
    const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    geocodeCache[key] = coords;
    return coords;
  }
  return null;
}

// Geocode specific address (street + house number) using Nominatim
async function geocodeAddress(street, number, municipality) {
  const key = `${number} ${street},${municipality}`;
  if (addressGeocodeCache[key]) return addressGeocodeCache[key];
  const url = `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(`${number} ${street}`)}&city=${encodeURIComponent(municipality)}&format=json&limit=1`;
  const response = await fetch(url, { headers: { 'Accept-Language': 'en' }, method: 'GET' });
  const data = await response.json();
  if (data && data.length > 0) {
    const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    addressGeocodeCache[key] = coords;
    return coords;
  }
  return null;
}

// Generate house numbers based on interval
function generateHouseNumbers(start, end, interval) {
  const houses = [];
  for (let i = start; i <= end; i++) {
    if (
      interval === "all" ||
      (interval === "even" && i % 2 === 0) ||
      (interval === "odd" && i % 2 !== 0)
    ) {
      houses.push(i);
    }
  }
  return houses;
}

// Note utilities via DB
async function listNotes(streetId, houseNumber) {
  return window.api.listNotes(streetId, houseNumber);
}

async function addNote(streetId, houseNumber, text) {
  return window.api.addNote(streetId, houseNumber, text);
}

async function deleteNote(noteId) {
  return window.api.deleteNote(noteId);
}

// Remove modal-based note UI and replace with dropdown below house number
async function showNoteDropdown(streetObj, number, houseSpan) {
  // Close any other open dropdowns
  document.querySelectorAll('.note-dropdown-inline').forEach(el => el.remove());

  // If already open for this house, toggle off
  if (houseSpan.classList.contains('note-dropdown-open')) {
    houseSpan.classList.remove('note-dropdown-open');
    return;
  }
  document.querySelectorAll('.house.note-dropdown-open').forEach(el => el.classList.remove('note-dropdown-open'));
  houseSpan.classList.add('note-dropdown-open');

  // Create dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'note-dropdown-inline';

  // Header
  const header = document.createElement('div');
  header.className = 'note-dropdown-header';
  header.textContent = `Notes for ${streetObj.name} ${number}`;
  dropdown.appendChild(header);

  // Notes list
  const noteList = document.createElement('div');
  noteList.className = 'note-list';
  dropdown.appendChild(noteList);

  // Input and button
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'New note...';
  input.className = 'note-input';
  dropdown.appendChild(input);

  const button = document.createElement('button');
  button.textContent = 'Add Note';
  button.className = 'note-add-button';
  dropdown.appendChild(button);

  // Render notes
  async function renderNotes() {
    const notes = await listNotes(streetObj.id, number);
    noteList.innerHTML = '';
    notes.forEach((note) => {
      const div = document.createElement('div');
      div.className = 'note';
      const text = document.createElement('span');
      text.textContent = note.text;
      const del = document.createElement('button');
      del.textContent = 'X';
      del.onclick = async () => {
        await deleteNote(note.id);
        await renderNotes();
        const hasAny = (await listNotes(streetObj.id, number)).length > 0;
        houseSpan.classList.toggle('has-note', hasAny);
      };
      div.appendChild(text);
      div.appendChild(del);
      noteList.appendChild(div);
    });
    houseSpan.classList.toggle('has-note', notes.length > 0);
  }
  await renderNotes();

  button.onclick = async () => {
    const val = input.value.trim();
    if (val !== '') {
      await addNote(streetObj.id, number, val);
      input.value = '';
      await renderNotes();
    }
  };

  // Insert dropdown after houseSpan
  houseSpan.parentNode.insertBefore(dropdown, houseSpan.nextSibling);
}

// Fetch house numbers from Overpass API
async function fetchHouseNumbersFromOSM(street, municipality) {
  const key = `${street},${municipality}`;
  if (houseNumberCache[key]) {
    return houseNumberCache[key];
  }
  // Overpass QL query (try to match addr:city as well)
  const query = `
    [out:json][timeout:25];
    (
      node["addr:street"="${street}"]["addr:housenumber"]["addr:city"="${municipality}"];
      way["addr:street"="${street}"]["addr:housenumber"]["addr:city"="${municipality}"];
      relation["addr:street"="${street}"]["addr:housenumber"]["addr:city"="${municipality}"];
      node["addr:street"="${street}"]["addr:housenumber"];
      way["addr:street"="${street}"]["addr:housenumber"];
      relation["addr:street"="${street}"]["addr:housenumber"];
    );
    out body;
  `;
  const url = 'https://overpass-api.de/api/interpreter';
  const response = await fetch(url, {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' }
  });
  const data = await response.json();
  const numbers = new Set();
  if (data.elements) {
    data.elements.forEach(el => {
      if (el.tags && el.tags['addr:housenumber']) {
        numbers.add(el.tags['addr:housenumber']);
      }
    });
  }
  // Only keep numbers that are valid integers
  const sorted = Array.from(numbers).filter(n => /^\d+$/.test(n)).map(Number).sort((a, b) => a - b);
  houseNumberCache[key] = sorted;
  return sorted;
}

async function loadStreets() {
  // Seed initial streets (idempotent via upsert)
  await window.api.seedStreets(initialStreets);

  const container = document.getElementById('street-list');
  container.innerHTML = '';

  // Fetch grouped streets from DB
  const municipalities = await window.api.listStreetsGrouped();

  Object.entries(municipalities).forEach(([municipalityName, streetsInMunicipality]) => {
    // Municipality block
    const muniBlock = document.createElement('div');
    muniBlock.className = 'municipality-block';

    const muniHeader = document.createElement('div');
    muniHeader.className = 'municipality-header';
    muniHeader.textContent = municipalityName;
    muniHeader.style.cursor = 'pointer';

    const muniContent = document.createElement('div');
    muniContent.className = 'municipality-content';
    muniContent.style.display = 'none';

    // Toggle municipality content
    muniHeader.addEventListener('click', () => {
      muniContent.style.display = muniContent.style.display === 'block' ? 'none' : 'block';
    });

    streetsInMunicipality.forEach(street => {
      const block = document.createElement('div');
      block.className = 'street-block';

      const header = document.createElement('div');
      header.className = 'street-header';
      let rangeText = '';
      if (typeof street.start === 'number' && typeof street.end === 'number' && street.start !== street.end) {
        rangeText = ` (${street.start}–${street.end})`;
      } else if (typeof street.start === 'number' && (street.end === null || street.end === undefined)) {
        rangeText = ` (${street.start}–)`;
      } else if (typeof street.start === 'number' && street.start === street.end) {
        rangeText = ` (${street.start})`;
      }
      header.textContent = street.name + rangeText;
      header.style.cursor = 'pointer';

      const houseList = document.createElement('div');
      houseList.className = 'house-numbers';
      houseList.style.display = 'none';

      function attachHouseSpan(number) {
        const span = document.createElement('span');
        span.className = 'house';
        span.textContent = number;
        span.dataset.streetId = String(street.id);
        span.dataset.number = String(number);
        // Mark if notes exist
        listNotes(street.id, number).then(n => {
          if (n.length > 0) span.classList.add('has-note');
        });
        span.addEventListener('click', async (e) => {
          e.stopPropagation();
          await showNoteDropdown(street, number, span);
          // Try exact address geocoding first; fall back to street center
          let coords = await geocodeAddress(street.name, number, street.municipality);
          if (!coords) {
            coords = await geocodeStreet(street.name, street.municipality);
          }
          if (coords && map) {
            if (selectedMarker) {
              map.removeLayer(selectedMarker);
            }
            selectedMarker = L.marker(coords).addTo(map).bindPopup(`${street.name} ${number}`).openPopup();
            map.setView(coords, 18);
          }
        });
        houseList.appendChild(span);
      }

      (async () => {
        let numbers = await window.api.listHouseNumbers(street.id);
        if (numbers && numbers.length > 0) {
          numbers.forEach(attachHouseSpan);
        } else if (typeof street.end === 'number') {
          numbers = generateHouseNumbers(street.start, street.end, street.interval);
          numbers.forEach(attachHouseSpan);
          await window.api.setHouseNumbers(street.id, numbers);
        } else {
          let fetched = false;
          let manualMode = false;
          header.addEventListener('click', async () => {
            if (!fetched && !manualMode) {
              houseList.innerHTML = '<span style="color:#888">Loading house numbers from OSM...</span>';
              const nums = await fetchHouseNumbersFromOSM(street.name, street.municipality);
              houseList.innerHTML = '';
              if (nums.length === 0) {
                const msg = document.createElement('span');
                msg.style.color = '#888';
                msg.textContent = 'No house numbers found in OSM.';
                houseList.appendChild(msg);
                const manualBtn = document.createElement('button');
                manualBtn.textContent = 'Manual Entry';
                manualBtn.className = 'manual-entry-btn';
                manualBtn.style.marginLeft = '10px';
                manualBtn.onclick = () => {
                  manualMode = true;
                  houseList.innerHTML = '';
                  // Show manual entry form
                  const form = document.createElement('div');
                  form.className = 'manual-entry-form';
                  form.innerHTML = `
                    <label>Start: <input type='number' class='manual-start' style='width:60px;'></label>
                    <label>End: <input type='number' class='manual-end' style='width:60px;'></label>
                    <button class='manual-apply'>Apply</button>
                  `;
                  houseList.appendChild(form);
                  form.querySelector('.manual-apply').onclick = async (e) => {
                    e.preventDefault();
                    const start = parseInt(form.querySelector('.manual-start').value);
                    const end = parseInt(form.querySelector('.manual-end').value);
                    if (!isNaN(start) && !isNaN(end) && end >= start) {
                      houseList.innerHTML = '';
                      const manualNums = [];
                      for (let number = start; number <= end; number++) {
                        attachHouseSpan(number);
                        manualNums.push(number);
                      }
                      await window.api.setHouseNumbers(street.id, manualNums);
                    } else {
                      alert('Please enter valid start and end numbers.');
                    }
                  };
                };
                houseList.appendChild(manualBtn);
              } else {
                nums.forEach(attachHouseSpan);
                await window.api.setHouseNumbers(street.id, nums);
              }
              fetched = true;
            }
          });
        }
      })();

      // Toggle house list on header click
      header.addEventListener('click', () => {
        houseList.style.display = houseList.style.display === 'flex' ? 'none' : 'flex';
      });

      block.appendChild(header);
      block.appendChild(houseList);
      muniContent.appendChild(block);
    });

    muniBlock.appendChild(muniHeader);
    muniBlock.appendChild(muniContent);
    container.appendChild(muniBlock);
  });
}

// Hook up add street form
(function bindAddStreetForm() {
  const form = document.getElementById('add-street-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('street-name').value.trim();
    const municipality = document.getElementById('street-municipality').value.trim();
    const startStr = document.getElementById('street-start').value;
    const endStr = document.getElementById('street-end').value;
    const interval = document.getElementById('street-interval').value;

    const start = startStr === '' ? null : Number(startStr);
    const end = endStr === '' ? null : Number(endStr);

    try {
      await window.api.addStreet({ name, municipality, start, end, interval });
      form.reset();
      await loadStreets();
    } catch (err) {
      alert(err.message || 'Failed to add street');
    }
  });
})();

// Export / Import buttons
(function bindExportImport() {
  const exportBtn = document.getElementById('export-db');
  const importBtn = document.getElementById('import-db');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const res = await window.api.exportDb();
      if (res && res.ok) {
        alert('Exported to: ' + res.filePath);
      }
    });
  }
  if (importBtn) {
    importBtn.addEventListener('click', async () => {
      try {
        const res = await window.api.importDb();
        if (res && res.ok) {
          await loadStreets();
          alert('Import completed');
        }
      } catch (e) {
        alert('Import failed: ' + (e.message || 'Unknown error'));
      }
    });
  }
})();

loadStreets();
