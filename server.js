const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const bundledDataDir = path.join(__dirname, 'data');
const runtimeDataDir = process.env.DATA_DIR || bundledDataDir;
const techniciansPath = path.join(runtimeDataDir, 'technicians.json');
const bundledTechniciansPath = path.join(bundledDataDir, 'technicians.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function normalizeTechnician(tech) {
  return {
    id: String(tech.id || '').trim(),
    name: String(tech.name || '').trim(),
    venmo: String(tech.venmo || '').trim(),
    cashApp: String(tech.cashApp || '').trim()
  };
}

function toSlug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tech';
}

function buildUniqueId(name, technicians, preferredId = '') {
  const existingIds = new Set(technicians.map((tech) => tech.id));
  const base = toSlug(preferredId || name);
  if (!existingIds.has(base)) {
    return base;
  }

  let count = 2;
  while (existingIds.has(`${base}-${count}`)) {
    count += 1;
  }
  return `${base}-${count}`;
}

async function readTechnicians() {
  const raw = await fs.readFile(techniciansPath, 'utf8');
  const technicians = JSON.parse(raw);
  return Array.isArray(technicians) ? technicians.map(normalizeTechnician) : [];
}

async function writeTechnicians(technicians) {
  const sorted = technicians
    .map(normalizeTechnician)
    .filter((tech) => tech.id && tech.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  await fs.writeFile(techniciansPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

async function ensureDataFile() {
  await fs.mkdir(runtimeDataDir, { recursive: true });
  try {
    await fs.access(techniciansPath);
  } catch (_error) {
    const fallback = await fs.readFile(bundledTechniciansPath, 'utf8');
    await fs.writeFile(techniciansPath, fallback, 'utf8');
  }
}

app.get('/api/technicians', async (_req, res) => {
  try {
    const technicians = await readTechnicians();
    res.json(technicians);
  } catch (error) {
    console.error('Failed to read technicians data:', error);
    res.status(500).json({ message: 'Failed to load technicians list.' });
  }
});

app.post('/api/technicians', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const venmo = String(req.body?.venmo || '').trim();
    const cashApp = String(req.body?.cashApp || '').trim();

    if (!name) {
      res.status(400).json({ message: 'Technician name is required.' });
      return;
    }

    const technicians = await readTechnicians();
    const exists = technicians.some(
      (tech) => tech.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) {
      res.status(409).json({ message: 'Technician already exists.' });
      return;
    }

    technicians.push({
      id: buildUniqueId(name, technicians),
      name,
      venmo,
      cashApp
    });

    await writeTechnicians(technicians);
    res.status(201).json(await readTechnicians());
  } catch (error) {
    console.error('Failed to add technician:', error);
    res.status(500).json({ message: 'Failed to add technician.' });
  }
});

app.put('/api/technicians/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const name = String(req.body?.name || '').trim();
    const venmo = String(req.body?.venmo || '').trim();
    const cashApp = String(req.body?.cashApp || '').trim();

    if (!id || !name) {
      res.status(400).json({ message: 'Technician id and name are required.' });
      return;
    }

    const technicians = await readTechnicians();
    const index = technicians.findIndex((tech) => tech.id === id);
    if (index === -1) {
      res.status(404).json({ message: 'Technician not found.' });
      return;
    }

    const duplicate = technicians.some(
      (tech, i) => i !== index && tech.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      res.status(409).json({ message: 'Another technician already has this name.' });
      return;
    }

    technicians[index] = {
      id,
      name,
      venmo,
      cashApp
    };

    await writeTechnicians(technicians);
    res.json(await readTechnicians());
  } catch (error) {
    console.error('Failed to update technician:', error);
    res.status(500).json({ message: 'Failed to update technician.' });
  }
});

app.delete('/api/technicians/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ message: 'Technician id is required.' });
      return;
    }

    const technicians = await readTechnicians();
    const nextTechnicians = technicians.filter((tech) => tech.id !== id);
    if (nextTechnicians.length === technicians.length) {
      res.status(404).json({ message: 'Technician not found.' });
      return;
    }

    await writeTechnicians(nextTechnicians);
    res.json(await readTechnicians());
  } catch (error) {
    console.error('Failed to delete technician:', error);
    res.status(500).json({ message: 'Failed to delete technician.' });
  }
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureDataFile()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Tip selector app running on http://localhost:${PORT}`);
      console.log(`Data file: ${techniciansPath}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize data file:', error);
    process.exit(1);
  });
