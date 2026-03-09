const techSelect = document.getElementById('tech-select');
const actions = document.getElementById('actions');
const selectedName = document.getElementById('selected-name');
const venmoLink = document.getElementById('venmo-link');
const cashAppLink = document.getElementById('cashapp-link');
const statusEl = document.getElementById('status');

const csvUrl = (window.APP_CONFIG && window.APP_CONFIG.googleSheetCsvUrl) || '';
let technicians = [];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#9e1a1a' : '#4f4b45';
}

function toSlug(value) {
  return (
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tech'
  );
}

function parseCsvRow(row) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

async function loadFromGoogleSheet(url) {
  const response = await fetch(url, { headers: { Accept: 'text/csv' } });
  if (!response.ok) {
    throw new Error(`Failed to load Google Sheet (HTTP ${response.status})`);
  }

  const text = await response.text();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const normalizeHeaderCell = (cell) =>
    cell
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');

  const nameAliases = ['name', 'technician', 'tech', 'staff', 'staffname', 'technicianname'];

  let headerLineIndex = -1;
  let header = [];
  for (let i = 0; i < lines.length; i += 1) {
    const cells = parseCsvRow(lines[i]).map(normalizeHeaderCell);
    if (cells.some((h) => nameAliases.includes(h))) {
      headerLineIndex = i;
      header = cells;
      break;
    }
  }

  if (headerLineIndex === -1) {
    throw new Error('Google Sheet must include a name column.');
  }

  const idx = {
    id: header.indexOf('id'),
    name: header.findIndex((h) => nameAliases.includes(h)),
    venmo: header.indexOf('venmo'),
    cashApp: header.findIndex((h) => h === 'cashapp' || h === 'cash' || h === 'cashappurl')
  };

  const rows = [];
  for (let i = headerLineIndex + 1; i < lines.length; i += 1) {
    const row = parseCsvRow(lines[i]);
    const name = (row[idx.name] || '').trim();
    if (!name) continue;

    rows.push({
      id: (idx.id >= 0 ? row[idx.id] : '')?.trim() || toSlug(name),
      name,
      venmo: (idx.venmo >= 0 ? row[idx.venmo] : '')?.trim() || '',
      cashApp: (idx.cashApp >= 0 ? row[idx.cashApp] : '')?.trim() || ''
    });
  }

  const used = new Set();
  return rows
    .map((tech) => {
      let id = tech.id || toSlug(tech.name);
      let n = 2;
      while (used.has(id)) {
        id = `${toSlug(tech.name)}-${n}`;
        n += 1;
      }
      used.add(id);
      return { ...tech, id };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function loadFromApi() {
  const response = await fetch('/api/technicians', {
    headers: { 'Content-Type': 'application/json' }
  });

  const payload = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to load technicians');
  }

  return Array.isArray(payload) ? payload : [];
}

function renderDropdown() {
  const previous = techSelect.value;
  techSelect.innerHTML = '<option value="">Select technician</option>';

  technicians.forEach((tech) => {
    const option = document.createElement('option');
    option.value = tech.id;
    option.textContent = tech.name;
    techSelect.appendChild(option);
  });

  if (technicians.some((tech) => tech.id === previous)) {
    techSelect.value = previous;
  }

  updateActions();
}

function updateActions() {
  const selectedId = techSelect.value;
  const selectedTech = technicians.find((tech) => tech.id === selectedId);

  if (!selectedTech) {
    actions.classList.add('hidden');
    setStatus('Please select your technician.');
    return;
  }

  selectedName.textContent = `Tip ${selectedTech.name}`;

  const hasVenmo = Boolean(selectedTech.venmo);
  const hasCashApp = Boolean(selectedTech.cashApp);

  venmoLink.href = hasVenmo ? selectedTech.venmo : '#';
  cashAppLink.href = hasCashApp ? selectedTech.cashApp : '#';

  venmoLink.classList.toggle('hidden', !hasVenmo);
  cashAppLink.classList.toggle('hidden', !hasCashApp);
  actions.classList.remove('hidden');

  if (!hasVenmo && !hasCashApp) {
    setStatus(`No tip links are configured for ${selectedTech.name}.`, true);
    return;
  }

  setStatus('Choose Venmo or Cash App.');
}

async function loadTechnicians() {
  try {
    setStatus('Loading technicians...');
    technicians = csvUrl ? await loadFromGoogleSheet(csvUrl) : await loadFromApi();

    renderDropdown();
    if (!technicians.length) {
      setStatus('No technicians are configured yet.');
      return;
    }

    setStatus('Please select your technician.');
  } catch (error) {
    setStatus(error.message || 'Unable to load technician list right now.', true);
  }
}

techSelect.addEventListener('change', updateActions);

loadTechnicians();
