const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 4000;
const DATABASE_URL = process.env.DATABASE_URL || '';

const bundledDataDir = path.join(__dirname, 'data');
const techniciansPath = path.join(bundledDataDir, 'technicians.json');

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
  return (
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tech'
  );
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

function buildFileStorage() {
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

  return {
    async init() {
      await fs.access(techniciansPath);
    },
    read: readTechnicians,
    async add(payload) {
      const technicians = await readTechnicians();
      const exists = technicians.some(
        (tech) => tech.name.toLowerCase() === payload.name.toLowerCase()
      );
      if (exists) {
        const error = new Error('Technician already exists.');
        error.code = 'DUPLICATE_NAME';
        throw error;
      }

      technicians.push({
        id: buildUniqueId(payload.name, technicians),
        name: payload.name,
        venmo: payload.venmo,
        cashApp: payload.cashApp
      });
      await writeTechnicians(technicians);
      return readTechnicians();
    },
    async update(id, payload) {
      const technicians = await readTechnicians();
      const index = technicians.findIndex((tech) => tech.id === id);
      if (index === -1) {
        const error = new Error('Technician not found.');
        error.code = 'NOT_FOUND';
        throw error;
      }

      const duplicate = technicians.some(
        (tech, i) => i !== index && tech.name.toLowerCase() === payload.name.toLowerCase()
      );
      if (duplicate) {
        const error = new Error('Another technician already has this name.');
        error.code = 'DUPLICATE_NAME';
        throw error;
      }

      technicians[index] = {
        id,
        name: payload.name,
        venmo: payload.venmo,
        cashApp: payload.cashApp
      };

      await writeTechnicians(technicians);
      return readTechnicians();
    },
    async remove(id) {
      const technicians = await readTechnicians();
      const next = technicians.filter((tech) => tech.id !== id);
      if (next.length === technicians.length) {
        const error = new Error('Technician not found.');
        error.code = 'NOT_FOUND';
        throw error;
      }

      await writeTechnicians(next);
      return readTechnicians();
    }
  };
}

function buildDatabaseStorage(connectionString) {
  const pool = new Pool({
    connectionString,
    ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false }
  });

  async function query(sql, values = []) {
    return pool.query(sql, values);
  }

  async function readAll() {
    const result = await query(
      'SELECT id, name, venmo, cash_app FROM technicians ORDER BY name ASC'
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      venmo: row.venmo || '',
      cashApp: row.cash_app || ''
    }));
  }

  return {
    async init() {
      await query(`
        CREATE TABLE IF NOT EXISTS technicians (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          venmo TEXT NOT NULL DEFAULT '',
          cash_app TEXT NOT NULL DEFAULT ''
        );
      `);
      await query(
        'CREATE UNIQUE INDEX IF NOT EXISTS technicians_name_unique_ci ON technicians ((LOWER(name)));'
      );

      const countResult = await query('SELECT COUNT(*)::int AS count FROM technicians');
      const count = countResult.rows[0]?.count || 0;
      if (count > 0) {
        return;
      }

      const seedRaw = await fs.readFile(techniciansPath, 'utf8');
      const seed = JSON.parse(seedRaw).map(normalizeTechnician).filter((t) => t.id && t.name);
      for (const tech of seed) {
        await query(
          `INSERT INTO technicians (id, name, venmo, cash_app)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO NOTHING`,
          [tech.id, tech.name, tech.venmo, tech.cashApp]
        );
      }
    },

    read: readAll,

    async add(payload) {
      const technicians = await readAll();
      const id = buildUniqueId(payload.name, technicians);

      try {
        await query(
          'INSERT INTO technicians (id, name, venmo, cash_app) VALUES ($1, $2, $3, $4)',
          [id, payload.name, payload.venmo, payload.cashApp]
        );
      } catch (error) {
        if (error.code === '23505') {
          const duplicate = new Error('Technician already exists.');
          duplicate.code = 'DUPLICATE_NAME';
          throw duplicate;
        }
        throw error;
      }

      return readAll();
    },

    async update(id, payload) {
      try {
        const result = await query(
          `UPDATE technicians
           SET name = $2, venmo = $3, cash_app = $4
           WHERE id = $1`,
          [id, payload.name, payload.venmo, payload.cashApp]
        );

        if (result.rowCount === 0) {
          const missing = new Error('Technician not found.');
          missing.code = 'NOT_FOUND';
          throw missing;
        }
      } catch (error) {
        if (error.code === '23505') {
          const duplicate = new Error('Another technician already has this name.');
          duplicate.code = 'DUPLICATE_NAME';
          throw duplicate;
        }
        throw error;
      }

      return readAll();
    },

    async remove(id) {
      const result = await query('DELETE FROM technicians WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        const missing = new Error('Technician not found.');
        missing.code = 'NOT_FOUND';
        throw missing;
      }

      return readAll();
    }
  };
}

const storage = DATABASE_URL ? buildDatabaseStorage(DATABASE_URL) : buildFileStorage();

function parsePayload(body) {
  return {
    name: String(body?.name || '').trim(),
    venmo: String(body?.venmo || '').trim(),
    cashApp: String(body?.cashApp || '').trim()
  };
}

app.get('/api/technicians', async (_req, res) => {
  try {
    res.json(await storage.read());
  } catch (error) {
    console.error('Failed to load technicians:', error);
    res.status(500).json({ message: 'Failed to load technicians list.' });
  }
});

app.post('/api/technicians', async (req, res) => {
  try {
    const payload = parsePayload(req.body);
    if (!payload.name) {
      res.status(400).json({ message: 'Technician name is required.' });
      return;
    }

    res.status(201).json(await storage.add(payload));
  } catch (error) {
    if (error.code === 'DUPLICATE_NAME') {
      res.status(409).json({ message: error.message });
      return;
    }

    console.error('Failed to add technician:', error);
    res.status(500).json({ message: 'Failed to add technician.' });
  }
});

app.put('/api/technicians/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const payload = parsePayload(req.body);

    if (!id || !payload.name) {
      res.status(400).json({ message: 'Technician id and name are required.' });
      return;
    }

    res.json(await storage.update(id, payload));
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ message: error.message });
      return;
    }
    if (error.code === 'DUPLICATE_NAME') {
      res.status(409).json({ message: error.message });
      return;
    }

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

    res.json(await storage.remove(id));
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      res.status(404).json({ message: error.message });
      return;
    }

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

storage
  .init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Tip selector app running on http://localhost:${PORT}`);
      console.log(DATABASE_URL ? 'Storage: PostgreSQL' : `Storage: file (${techniciansPath})`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize storage:', error);
    process.exit(1);
  });
