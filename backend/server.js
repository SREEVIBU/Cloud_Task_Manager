import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = process.env.PORT || 5000;

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
}));
app.use(express.json());

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// Health endpoint: useful for checking whether the API and database are reachable.
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(500).json({ status: 'error', database: 'unavailable' });
  }
});

// Read: return all tasks, newest first.
app.get('/api/tasks', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, completed, created_at FROM tasks ORDER BY id DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List tasks failed:', error.message);
    res.status(500).json({ error: 'Could not load tasks.' });
  }
});

// Create: validate title and insert it using a parameterized query.
app.post('/api/tasks', async (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  if (!title) return res.status(400).json({ error: 'Task title is required.' });
  if (title.length > 200) {
    return res.status(400).json({ error: 'Task title must be 200 characters or fewer.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, completed, created_at',
      [title]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create task failed:', error.message);
    res.status(500).json({ error: 'Could not create task.' });
  }
});

// Update: toggle the completion status.
app.patch('/api/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid task ID.' });
  }
  if (typeof req.body.completed !== 'boolean') {
    return res.status(400).json({ error: 'completed must be true or false.' });
  }

  try {
    const result = await pool.query(
      'UPDATE tasks SET completed = $1 WHERE id = $2 RETURNING id, title, completed, created_at',
      [req.body.completed, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found.' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update task failed:', error.message);
    res.status(500).json({ error: 'Could not update task.' });
  }
});

// Delete: remove one task by ID.
app.delete('/api/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid task ID.' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found.' });
    res.status(204).end();
  } catch (error) {
    console.error('Delete task failed:', error.message);
    res.status(500).json({ error: 'Could not delete task.' });
  }
});

initializeDatabase()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Task API listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Database initialization failed:', error.message);
    process.exit(1);
  });
