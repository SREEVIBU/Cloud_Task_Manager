import React, { useState, useEffect, useCallback } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
// ... rest of your code

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Shared helper: call the backend and turn non-2xx responses into readable errors.
  const request = async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${response.status})`);
    }
    return response.status === 204 ? null : response.json();
  };

  // Load saved tasks from PostgreSQL through the backend.
  const loadTasks = useCallback(async () => {
    try {
      setError('');
      const data = await request('/api/tasks');
      setTasks(data);
    } catch (err) {
      setError(`${err.message}. Check that the backend and database are running.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Create a task, then refresh the list from the server.
  const addTask = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await request('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ title })
      });
      setTitle('');
      await loadTasks();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Update only the completion field for this task.
  const toggleTask = async (task) => {
    try {
      await request(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !task.completed })
      });
      await loadTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  // Delete the task from the database, then refresh the display.
  const deleteTask = async (id) => {
    try {
      await request(`/api/tasks/${id}`, { method: 'DELETE' });
      await loadTasks();
    } catch (err) {
      setError(err.message);
    }
  };

  const completedCount = tasks.filter((task) => task.completed).length;

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">✓</span> Cloud Task Manager</div>
        <span className="live"><span /> Cloud-connected</span>
      </header>

      <section className="hero">
        <p className="eyebrow">YOUR WORKSPACE</p>
        <h1>Small steps.<br /><span>Big progress.</span></h1>
        <p className="subtitle">A simple task manager running on a real cloud backend and database.</p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div><h2>My tasks</h2><p>{completedCount} of {tasks.length} completed</p></div>
          <div className="count">{tasks.length}</div>
        </div>

        <form className="add-form" onSubmit={addTask}>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs to get done?"
            maxLength={200}
            aria-label="New task"
          />
          <button disabled={busy || !title.trim()} type="submit">{busy ? 'Adding…' : '+ Add task'}</button>
        </form>

        {error && <div className="error" role="alert">{error}</div>}
        {loading ? <p className="empty">Loading tasks from the cloud…</p> :
          tasks.length === 0 ? <div className="empty"><span>✦</span><strong>Nothing on your list yet</strong><p>Add your first task above.</p></div> :
          <ul className="task-list">
            {tasks.map((task) => (
              <li className={`task ${task.completed ? 'done' : ''}`} key={task.id}>
                <button className="check" aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'} onClick={() => toggleTask(task)}>
                  {task.completed ? '✓' : ''}
                </button>
                <span className="task-title">{task.title}</span>
                <button className="delete" aria-label={`Delete ${task.title}`} onClick={() => deleteTask(task.id)}>×</button>
              </li>
            ))}
          </ul>
        }
        <button className="refresh" onClick={loadTasks}>↻ Refresh from database</button>
      </section>

      <footer><span>REACT</span><i /> <span>EXPRESS API</span><i /> <span>POSTGRESQL</span><p>Built to learn cloud deployment</p></footer>
    </main>
  );
}
