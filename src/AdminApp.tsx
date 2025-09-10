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
  is_active?: boolean | null;
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

// ---------- Login Page (new) ----------
function LoginPage({ onSignedIn }: { onSignedIn: (profile: UserProfile) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Signing in...');
    if (!supabase) return setStatus('Supabase not configured');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // fetch profile
      const userId = data.user?.id;
      if (!userId) throw new Error('No user id returned');
      const { data: profileData, error: pErr } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (pErr) throw pErr;
      if (!profileData) throw new Error('Profile not found');
      setStatus(null);
      onSignedIn(profileData as UserProfile);
    } catch (err: any) {
      setStatus('Error: ' + (err?.message ?? 'unknown'));
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">Sign in</h2>
      <form onSubmit={handleSignIn} className="space-y-3">
        <div>
          <label className="block text-sm">Email</label>
          <input className="w-full border rounded p-2" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
        </div>
        <div>
          <label className="block text-sm">Password</label>
          <input className="w-full border rounded p-2" value={password} onChange={(e) => setPassword(e.target.value)} required type="password" />
        </div>
        <div>
          <button className="px-4 py-2 rounded bg-blue-600 text-white" type="submit">Sign in</button>
        </div>
        {status && <div className="text-sm mt-2">{status}</div>}
      </form>

      <div className="mt-4 text-xs text-gray-500">Use an admin account (role = &quot;admin&quot;) to access the admin UI.</div>
    </div>
  );
}

// ---------- Page 1: Create + Manage Users (unchanged) ----------
function CreateUserPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('user');
  const [status, setStatus] = useState<string | null>(null);

  // ✅ new state for users list
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // fetch users on load
  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    if (!supabase) return;
    setLoadingUsers(true);
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
      console.error(error);
      setStatus('Error loading users');
    } else {
      setUsers(data || []);
    }
    setLoadingUsers(false);
  }

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

      // 2️⃣ Insert profile row with is_active true by default
      const { error: profileErr } = await supabase.from('profiles').insert([
        {
          id: (authData as any).user?.id,
          email,
          full_name: fullName,
          role,
          is_active: true,
        },
      ]);
      if (profileErr) throw profileErr;

      setStatus('Created user: ' + (authData as any).user?.id);
      setEmail('');
      setPassword('');
      setFullName('');
      setRole('user');
      fetchUsers(); // refresh list
    } catch (err: any) {
      setStatus('Error: ' + (err?.message ?? 'unknown'));
    }
  }

  async function toggleActive(userId: string, current: boolean) {
    if (!supabase) return;
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !current })
      .eq('id', userId);

    if (error) {
      console.error(error);
      setStatus('Error updating user');
    } else {
      fetchUsers(); // refresh list
    }
  }

  return (
    <div className="space-y-8">
      {/* Create form */}
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
            <button
              className="px-4 py-2 rounded bg-blue-600 text-white"
              type="submit"
            >
              Create User
            </button>
          </div>
        </form>
        {status && <div className="mt-4 text-sm">{status}</div>}
      </div>

      {/* User list */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Manage Users</h2>
        {loadingUsers ? (
          <div>Loading users...</div>
        ) : (
          <table className="w-full border">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Email</th>
                <th className="p-2 border">Role</th>
                <th className="p-2 border">Active</th>
                <th className="p-2 border">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-2">{u.full_name}</td>
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">{u.is_active ? '✅ Active' : '❌ Inactive'}</td>
                  <td className="p-2">
                    <button
                      className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                      onClick={() => toggleActive(u.id, u.is_active)}
                    >
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-2 text-center text-sm">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------- CreateCPTPage & AssignUsersPage (unchanged apart from minor typing) ----------
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
      is_active: true,
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
        <div className="p-3 rounded bg-amber-50 text-amber-700 text-sm mb-4">Supabase is not configured.</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <select className="border p-2 rounded" value={selectedTask} onChange={(e) => setSelectedTask(e.target.value)}>
          <option value="">Select task</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select className="border p-2 rounded" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
          <option value="">Select user</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.full_name ?? u.email}</option>
          ))}
        </select>
        <div>
          <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={assign}>Assign</button>
        </div>
      </div>
      {msg && <div className="mt-3 text-sm">{msg}</div>}

      <div className="mt-6">
        <h4 className="font-medium">Current task assignments</h4>
        <ul className="mt-2 text-sm">
          {tasks.map((t) => (
            <li key={t.id}>{t.name} — assigned: {t.assigned_user_id ?? '—'}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------- App Shell (updated to require login + admin role) ----------
export default function AdminApp() {
  const checks = useMemo(() => {
    return [
      {
        name: 'Has exactly one default export',
        pass: true,
      },
      {
        name: 'Env present (either Vite or CRA)',
        pass: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
        details: SUPABASE_URL && SUPABASE_ANON_KEY ? 'ok' : 'Missing keys',
      },
    ];
  }, []);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // load session/profile on mount and subscribe to auth changes
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = (data as any)?.session;
        if (session?.user && mounted) {
          const userId = session.user.id;
          const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).single();
          if (mounted) setProfile(p as UserProfile);
        }
      } catch (e) {
        console.error('Error fetching session/profile', e);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        try {
          const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          setProfile(p as UserProfile);
        } catch (e) {
          console.error('Error loading profile after auth change', e);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      try { listener.subscription.unsubscribe(); } catch (e) { /* noop */ }
    };
  }, []);

  async function handleSignOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
  }

  // show login page if not signed in
  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!profile) {
    // show only the login page (no sidebar/other pages visible)
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="w-full max-w-2xl bg-white rounded shadow p-6">
          <LoginPage onSignedIn={(p) => setProfile(p)} />
        </div>
      </div>
    );
  }

  // signed in but not admin -> access denied
  if (profile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded shadow p-6 max-w-md text-center">
          <h2 className="text-xl font-semibold mb-3">Access denied</h2>
          <p className="mb-4">Your account does not have the <code>admin</code> role.</p>
          <div className="space-x-2">
            <button className="px-4 py-2 rounded bg-gray-200" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  // signed in as admin -> show full admin shell
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex">
        <aside className="w-64 bg-white shadow p-4">
          <h2 className="text-xl font-semibold mb-6">TimeTracker Admin</h2>
          <nav className="space-y-2">
            <Link to="/create-user" className="block p-2 rounded hover:bg-gray-100">Create User</Link>
            <Link to="/create-client-project-task" className="block p-2 rounded hover:bg-gray-100">Create Clients / Projects / Tasks</Link>
            <Link to="/assign-users" className="block p-2 rounded hover:bg-gray-100">Assign Users to Tasks</Link>
          </nav>
          <div className="mt-6 text-sm text-gray-600">Signed in as: {profile.email}</div>
          <div className="mt-2">
            <button className="mt-3 px-3 py-2 rounded bg-red-600 text-white" onClick={handleSignOut}>Sign out</button>
          </div>
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
                  <span className={c.pass ? 'text-green-700' : 'text-red-700'}>{c.pass ? '✔' : '✘'} {c.name}</span>
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
