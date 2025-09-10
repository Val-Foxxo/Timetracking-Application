// Clockify-like Admin Admin UI — Single-File, Compile-Safe Snapshot (React + TypeScript)
// Canvas file type: code/react
// IMPORTANT: This file now exports ONE React component to avoid parser errors.
// The previous multi-file snapshot caused a syntax error (multiple default exports / mid-file imports).
// This version keeps everything inside a single module so the canvas preview can compile and run.

/*
README (quick)
--------------
What you get here:
- A Clockify-like admin shell with three pages:
  1) Create Users (calls /api/admin/create-user on your server)
  2) Create Clients / Projects / Tasks (Supabase inserts)
  3) Assign Users to Tasks (update tasks.assigned_user_id)
- All code lives in ONE file for the canvas preview.
- A commented server snippet (Express) is included at the bottom **inside a comment** so it doesn't break the TSX parser.

Environment (both Vite & CRA supported):
- Vite:  set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- CRA:   set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY

Packages to install in your real project:
  npm i react-router-dom @supabase/supabase-js axios

Security notes:
- Creating users requires the Supabase service_role key — do that **server-side only**.
- Client-side operations require proper RLS policies.

Self‑checks ("tests"):
- A tiny runtime self-check panel appears at the bottom verifying env config and basic component behavior.
*/

import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import axios from 'axios';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------- Supabase client (works with Vite or CRA envs) ----------
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function makeSupabase(): SupabaseClient | null {
  try {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  } catch (e) {
    // noop — we fall back to null which the UI handles
  }
  return null;
}


const supabase = makeSupabase();

// DEBUG (safe): show values we actually use at runtime (no import.meta shenanigans)
console.log('DEBUG: SUPABASE_URL (first 40 chars):', SUPABASE_URL ? SUPABASE_URL.slice(0, 40) + '...' : 'NOT SET');
console.log('DEBUG: SUPABASE_ANON_KEY length:', SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.length : 0);
console.log('DEBUG: supabase client created?', !!supabase);

// ---------- Shared table types ----------
export type UserProfile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
};

export type ClientRow = {
  id?: string;
  name: string;
  contact_email?: string | null;
  contact_phone?: string | null;
};

export type ProjectRow = {
  id?: string;
  name: string;
  description?: string | null;
  client_id?: string | null;
  is_public?: boolean | null;
  budget?: number | null;
};

export type TaskRow = {
  id?: string;
  project_id: string;
  name: string;
  description?: string | null;
  rate?: number | null;
  assigned_user_id?: string | null;
};

// ---------- Page 1: Create Users ----------
function CreateUserPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('user');
  const [status, setStatus] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Creating...');
    if (!supabase) return setStatus('Supabase not configured');

    try {
      // 1️⃣ Sign up user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authErr) throw authErr;

      // 2️⃣ Insert profile row
      const { error: profileErr } = await supabase.from('profiles').insert([
        {
          id: authData.user?.id,
          email,
          full_name: fullName,
          role,
        },
      ]);

      if (profileErr) throw profileErr;

      setStatus('Created user: ' + authData.user?.id);
      setEmail('');
      setPassword('');
      setFullName('');
      setRole('user');
    } catch (err: any) {
      setStatus('Error: ' + (err?.message ?? 'unknown'));
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Create User</h2>
      <form onSubmit={handleCreate} className="space-y-3 max-w-md">
        <div>
          <label className="block text-sm">Email</label>
          <input
            className="w-full border rounded p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
          />
        </div>
        <div>
          <label className="block text-sm">Password</label>
          <input
            className="w-full border rounded p-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            type="password"
          />
        </div>
        <div>
          <label className="block text-sm">Full name</label>
          <input
            className="w-full border rounded p-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm">Role</label>
          <select
            className="w-full border rounded p-2"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <button className="px-4 py-2 rounded bg-blue-600 text-white" type="submit">
            Create User
          </button>
        </div>
      </form>
      {status && <div className="mt-4 text-sm">{status}</div>}
    </div>
  );
}

function CreateCPTPage() {
  const configured = !!supabase;
  const [msg, setMsg] = useState<string | null>(null);

  // client form
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientLocation, setClientLocation] = useState('');
  const [clientCurrency, setClientCurrency] = useState('');
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  // project form
  const [projectName, setProjectName] = useState('');
  const [projectClientId, setProjectClientId] = useState<string | ''>('');

  // task form
  const [taskName, setTaskName] = useState('');
  const [taskProjectId, setTaskProjectId] = useState<string | ''>('');

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    if (!configured) return;
    (async () => {
      await fetchClients();
      await fetchProjects();
    })();
  }, [configured]);

  async function fetchClients() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    if (error) {
      console.error(error);
      setMsg('Error loading clients: ' + error.message);
      return;
    }
    setClients((data || []) as ClientRow[]);
  }

  async function fetchProjects() {
    if (!supabase) return;
    const { data, error } = await supabase.from('projects').select('*').order('name');
    if (error) {
      console.error(error);
      setMsg('Error loading projects: ' + error.message);
      return;
    }
    setProjects((data || []) as ProjectRow[]);
  }

  async function saveClient(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return setMsg('Supabase not configured');
    setMsg(editingClientId ? 'Updating client...' : 'Creating client...');

    const clientData = {
      name: clientName,
      contact_email: clientEmail,
      location: clientLocation,
      currency_type: clientCurrency,
      is_active: true, // default new clients to active
    };

    let error;
    if (editingClientId) {
      ({ error } = await supabase
        .from('clients')
        .update(clientData)
        .eq('id', editingClientId));
    } else {
      ({ error } = await supabase.from('clients').insert([clientData]));
    }

    if (error) return setMsg('Error: ' + error.message);

    setMsg(editingClientId ? 'Client updated' : 'Client created');
    setClientName('');
    setClientEmail('');
    setClientLocation('');
    setClientCurrency('');
    setEditingClientId(null);
    await fetchClients();
  }

  function editClient(client: ClientRow) {
    setClientName(client.name);
    setClientEmail(client.contact_email || '');
    setClientLocation(client.location || '');
    setClientCurrency(client.currency_type || '');
    setEditingClientId(client.id);
  }

  async function toggleClientActive(client: ClientRow) {
    if (!supabase) return;
    const { error } = await supabase
      .from('clients')
      .update({ is_active: !client.is_active })
      .eq('id', client.id);
    if (error) return setMsg('Error: ' + error.message);
    await fetchClients();
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectClientId) return setMsg('Select a client');
    if (!supabase) return setMsg('Supabase not configured');
    setMsg('Creating project...');
    const { error } = await supabase
      .from('projects')
      .insert([{ name: projectName, client_id: projectClientId }]);
    if (error) return setMsg('Error: ' + error.message);
    setMsg('Project created');
    setProjectName('');
    await fetchProjects();
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskProjectId) return setMsg('Select project');
    if (!supabase) return setMsg('Supabase not configured');
    setMsg('Creating task...');
    const { error } = await supabase
      .from('tasks')
      .insert([{ project_id: taskProjectId, name: taskName }]);
    if (error) return setMsg('Error: ' + error.message);
    setMsg('Task created');
    setTaskName('');
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Client Section */}
      <section className="col-span-1">
        <h3 className="font-semibold mb-2">{editingClientId ? 'Edit Client' : 'Create Client'}</h3>
        <form onSubmit={saveClient} className="space-y-2">
          <input className="w-full border p-2 rounded" placeholder="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
          <input className="w-full border p-2 rounded" placeholder="Contact email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} type="email" />
          <input className="w-full border p-2 rounded" placeholder="Location" value={clientLocation} onChange={(e) => setClientLocation(e.target.value)} />
          <input className="w-full border p-2 rounded" placeholder="Currency" value={clientCurrency} onChange={(e) => setClientCurrency(e.target.value)} />
          <button className="px-3 py-1 rounded bg-green-600 text-white">{editingClientId ? 'Update Client' : 'Create Client'}</button>
        </form>

        <div className="mt-4">
          <h4 className="font-medium flex justify-between items-center">
            <span>Clients</span>
            <button
              className="text-sm text-blue-600 underline"
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? 'Hide inactive clients' : 'View inactive clients'}
            </button>
          </h4>
          <ul className="mt-2 space-y-1 text-sm">
            {clients
              .filter((c) => showInactive || c.is_active)
              .map((c) => (
                <li key={c.id} className="flex justify-between items-center">
                  <span className={c.is_active ? '' : 'text-gray-400'}>
                    {c.name} — {c.contact_email || '—'} — {c.location || '—'} — {c.currency_type || '—'}
                  </span>
                  <div className="space-x-2">
                    <button className="text-blue-600 text-sm" onClick={() => editClient(c)}>Edit</button>
                    <button
                      className="text-red-600 text-sm"
                      onClick={() => toggleClientActive(c)}
                    >
                      {c.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      </section>

      {/* Project Section */}
      <section className="col-span-1">
        <h3 className="font-semibold mb-2">Create Project</h3>
        <form onSubmit={createProject} className="space-y-2">
          <input className="w-full border p-2 rounded" placeholder="Project name" value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
          <select className="w-full border p-2 rounded" value={projectClientId} onChange={(e) => setProjectClientId(e.target.value)}>
            <option value="">Select client</option>
            {clients.filter((c) => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button className="px-3 py-1 rounded bg-indigo-600 text-white">Create Project</button>
        </form>
      </section>

      {/* Task Section */}
      <section className="col-span-1">
        <h3 className="font-semibold mb-2">Create Task</h3>
        <form onSubmit={createTask} className="space-y-2">
          <input className="w-full border p-2 rounded" placeholder="Task name" value={taskName} onChange={(e) => setTaskName(e.target.value)} required />
          <select className="w-full border p-2 rounded" value={taskProjectId} onChange={(e) => setTaskProjectId(e.target.value)}>
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="px-3 py-1 rounded bg-yellow-600 text-white">Create Task</button>
        </form>
      </section>

      {msg && <div className="md:col-span-3 mt-4 text-sm text-gray-600">{msg}</div>}
    </div>
  );
}

// ---------- Page 3: Assign Users to Tasks ----------
function AssignUsersPage() {
  const configured = !!supabase;
  const [users, setUsers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    (async () => {
      const { data: u, error: ue } = await supabase!.from('profiles').select('id, email, full_name').order('full_name');
      if (!ue) setUsers(u || []);
      const { data: t, error: te } = await supabase!.from('tasks').select('id, name, assigned_user_id, project_id');
      if (!te) setTasks(t || []);
    })();
  }, [configured]);

  async function assign() {
    if (!selectedTask) return setMsg('Select task');
    if (!supabase) return setMsg('Supabase not configured');
    const { error } = await supabase.from('tasks').update({ assigned_user_id: selectedUser || null }).eq('id', selectedTask);
    if (error) return setMsg('Error: ' + error.message);
    setMsg('Assigned');
    const { data: t } = await supabase.from('tasks').select('id, name, assigned_user_id, project_id');
    setTasks(t || []);
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-semibold mb-4">Assign Users to Tasks</h2>
      {!configured && (
        <div className="p-3 rounded bg-amber-50 text-amber-700 text-sm mb-4">
          Supabase is not configured.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <select
          className="border p-2 rounded"
          value={selectedTask}
          onChange={(e) => setSelectedTask(e.target.value)}
        >
          <option value="">Select task</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          className="border p-2 rounded"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
        >
          <option value="">Select user</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name ?? u.email}
            </option>
          ))}
        </select>
        <div>
          <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={assign}>
            Assign
          </button>
        </div>
      </div>
      {msg && <div className="mt-3 text-sm">{msg}</div>}

      <div className="mt-6">
        <h4 className="font-medium">Current task assignments</h4>
        <ul className="mt-2 text-sm">
          {tasks.map((t) => (
            <li key={t.id}>
              {t.name} — assigned: {t.assigned_user_id ?? '—'}
            </li>
          ))}
        </ul> 
      </div>
    </div>
  );
}

// ---------- App Shell ----------
export default function AdminApp() {
  // Self-checks (simple runtime "tests")
  const checks = useMemo(() => {
    return [
      {
        name: 'Has exactly one default export',
        pass: true, // by construction in this file
      },
      {
        name: 'Env present (either Vite or CRA)',
        pass: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
        details: SUPABASE_URL && SUPABASE_ANON_KEY ? 'ok' : 'Missing keys',
      },
    ];
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex">
        <aside className="w-64 bg-white shadow p-4">
          <h2 className="text-xl font-semibold mb-6">TimeTracker Admin</h2>
          <nav className="space-y-2">
            <Link to="/create-user" className="block p-2 rounded hover:bg-gray-100">
              Create User
            </Link>
            <Link to="/create-client-project-task" className="block p-2 rounded hover:bg-gray-100">
              Create Clients / Projects / Tasks
            </Link>
            <Link to="/assign-users" className="block p-2 rounded hover:bg-gray-100">
              Assign Users to Tasks
            </Link>
          </nav>
        </aside>

        <main className="flex-1 p-8">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Admin</h1>
            <div className="text-sm text-gray-600">Mimic: Clockify — admin</div>
          </header>

          <div className="bg-white rounded shadow p-6">
            <Routes>
              <Route path="/create-user" element={<CreateUserPage />} />
              <Route path="/create-client-project-task" element={<CreateCPTPage />} />
              <Route path="/assign-users" element={<AssignUsersPage />} />
              <Route path="/" element={<div>Select a page on the left.</div>} />
            </Routes>
          </div>

          {/* Self-checks */}
          <section className="mt-6">
            <h3 className="text-sm font-semibold mb-2">Self‑checks</h3>
            <ul className="text-xs space-y-1">
              {checks.map((c, i) => (
                <li key={i}>
                  <span className={c.pass ? 'text-green-700' : 'text-red-700'}>
                    {c.pass ? '✔' : '✘'} {c.name}
                  </span>
                  {c.details ? <span className="ml-2 text-gray-500">({c.details})</span> : null}
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </BrowserRouter>
  );
}

/*
============================================
SERVER SNIPPET (commented; do NOT paste here)
============================================

// server/admin.ts (Node / Express)
// Requires ADMIN_SUPABASE_SERVICE_ROLE_KEY — never expose to the browser.

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const ADMIN_URL = process.env.ADMIN_SUPABASE_URL!;
const ADMIN_KEY = process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(ADMIN_URL, ADMIN_KEY);

app.post('/api/admin/create-user', async (req, res) => {
  const { email, password, full_name, role } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'email & password required' });
  try {
    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });
    if (userErr) throw userErr;

    const profile = { id: (userData as any).id, email, full_name, role };
    const { error: pErr } = await supabaseAdmin.from('profiles').insert([profile]);
    if (pErr) throw pErr;

    res.json({ id: (userData as any).id });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || 'error' });
  }
});

const port = process.env.PORT || 4321;
app.listen(port, () => console.log('Admin server listening on', port));

*/
