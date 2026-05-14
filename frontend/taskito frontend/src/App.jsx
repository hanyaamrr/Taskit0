import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Circle, Plus, Trash2, Edit2, LogIn, Lock, User as UserIcon } from 'lucide-react';

const API_URL = 'http://localhost:8080';

export default function TaskManagerApp() {
  const [user, setUser] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  
  // Backend expects: email, password, username
  const [formData, setFormData] = useState({ email: '', password: '', username: '' });
  
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({ title: '', description: '' });
  const [editingTask, setEditingTask] = useState(null);
  const [error, setError] = useState('');

  /* ------------------------------------------------------ */
  /* 1. SSO & LocalStorage Listener                        */
  /* ------------------------------------------------------ */
  useEffect(() => {
    // Check if we just came back from Google Login (URL params)
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('token');
    const ssoName = params.get('name');
    const ssoEmail = params.get('email');

    if (ssoToken) {
      // If we have a token from Google, save it and clean URL
      const userData = { 
        token: ssoToken, 
        name: ssoName || 'Google User',
        email: ssoEmail || 'Google Email'
      }; 
      
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      window.history.replaceState({}, document.title, "/");
    } else {
      // Otherwise check localStorage
      const saved = localStorage.getItem('user');
      if (saved) setUser(JSON.parse(saved));
    }
  }, []);

  /* ------------------------------------------------------ */
  /* 2. Fetch tasks (With Auto-Logout on 403)              */
  /* ------------------------------------------------------ */
  useEffect(() => {
    if (user?.token) fetchTasks();
  }, [user]);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user.token}`
  });

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/tasks`, { headers: authHeaders() });
      
      if (res.status === 403 || res.status === 401) {
        logout(); // Token expired or invalid (e.g. server restart)
        return;
      }
      
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error(err);
    }
  };

  /* ------------------------------------------------------ */
  /* 3. Authentication Logic                               */
  /* ------------------------------------------------------ */
  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');

    const endpoint = isLogin ? '/auth/login' : '/auth/register';

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      // Success: Save token
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      setFormData({ email: '', password: '', username: '' });

    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/oauth2/authorization/google`;
  };

  /* ------------------------------------------------------ */
  /* 4. Task Operations                                    */
  /* ------------------------------------------------------ */
  const addTask = async () => {
    if (!newTask.title.trim()) return;
    setError('');

    try {
      const res = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(newTask)
      });

      if (!res.ok) throw new Error('Could not save task. Check connection.');
      
      const realTask = await res.json();
      setTasks([...tasks, realTask]);
      setNewTask({ title: '', description: '' });
    } catch (err) {
      setError(err.message);
    }
  };

  const updateTask = async (id, updates) => {
    const previousTasks = [...tasks];
    setTasks(tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)));

    try {
      const res = await fetch(`${API_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTasks(previousTasks);
      alert("Failed to update task");
    }
    setEditingTask(null);
  };

  const deleteTask = async (id) => {
    setTasks(tasks.filter((t) => t.id !== id));
    try {
      await fetch(`${API_URL}/tasks/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
    } catch (err) {
       console.error(err);
    }
  };

  const toggleComplete = (t) => updateTask(t.id, { completed: !t.completed });

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    setTasks([]);
    setError('');
  };

  /* ------------------------------------------------------ */
  /* Render                                                */
  /* ------------------------------------------------------ */
  if (!user) {
    return (
      <AuthPage
        isLogin={isLogin}
        setIsLogin={setIsLogin}
        formData={formData}
        setFormData={setFormData}
        error={error}
        handleAuth={handleAuth}
        handleGoogleLogin={handleGoogleLogin}
      />
    );
  }

  return (
    <MainAppUI
      user={user}
      logout={logout}
      tasks={tasks}
      newTask={newTask}
      setNewTask={setNewTask}
      addTask={addTask}
      editingTask={editingTask}
      setEditingTask={setEditingTask}
      updateTask={updateTask}
      deleteTask={deleteTask}
      toggleComplete={toggleComplete}
      error={error}
      setError={setError}
    />
  );
}

/* ================================================================= */
/* COMPONENTS                                                        */
/* ================================================================= */

function AuthPage({ isLogin, setIsLogin, formData, setFormData, error, handleAuth, handleGoogleLogin }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Secure Tasks</h1>
            <p className="text-gray-500 mt-2">AES Encrypted • JWT Auth</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <InputField
                icon={<UserIcon className="w-5 h-5 text-gray-400" />}
                value={formData.username}
                placeholder="Username"
                onChange={(v) => setFormData({ ...formData, username: v })}
              />
            )}

            <InputField
              icon={<UserIcon className="w-5 h-5 text-gray-400" />}
              type="email"
              value={formData.email}
              placeholder="Email Address"
              onChange={(v) => setFormData({ ...formData, email: v })}
            />

            <InputField
              icon={<Lock className="w-5 h-5 text-gray-400" />}
              type="password"
              value={formData.password}
              placeholder="Password"
              onChange={(v) => setFormData({ ...formData, password: v })}
            />

            <button className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition shadow-lg">
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              className="mt-4 w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              <span className="mr-2">G</span> Google SSO
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-gray-600">
            {isLogin ? "New to SecureTasks? " : "Already have an account? "}
            <button className="text-blue-600 font-semibold hover:underline" onClick={() => setIsLogin(!isLogin)}>
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function MainAppUI({ user, logout, tasks, newTask, setNewTask, addTask, editingTask, setEditingTask, updateTask, deleteTask, toggleComplete, error, setError }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-6 h-6 text-green-400" />
            <h1 className="text-xl font-bold">SecureTask Manager</h1>
          </div>
          <div className="flex items-center space-x-6">
            <span className="text-slate-300 text-sm hidden sm:block">
              {user.name ? `Hello, ${user.name}` : user.email}
            </span>
            <button onClick={logout} className="flex items-center space-x-1 text-sm bg-red-600 hover:bg-red-700 px-3 py-2 rounded transition">
              <LogIn className="w-4 h-4" /> <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            <span className="block sm:inline">{error}</span>
            <span className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError('')}>
              <strong className="text-xl cursor-pointer">&times;</strong>
            </span>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex space-x-3">
            <input
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="What needs to be done?"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none"
            />
             <input
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Details (Encrypted)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none hidden sm:block"
            />
            <button onClick={addTask} className="bg-slate-900 text-white px-6 rounded-lg hover:bg-slate-800 transition">
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>

        <TaskList
          tasks={tasks}
          editingTask={editingTask}
          setEditingTask={setEditingTask}
          updateTask={updateTask}
          deleteTask={deleteTask}
          toggleComplete={toggleComplete}
        />
      </div>
    </div>
  );
}

function TaskList({ tasks, editingTask, setEditingTask, updateTask, deleteTask, toggleComplete }) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
        <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">No encrypted tasks found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          editingTask={editingTask}
          setEditingTask={setEditingTask}
          updateTask={updateTask}
          deleteTask={deleteTask}
          toggleComplete={toggleComplete}
        />
      ))}
    </div>
  );
}

function TaskCard({ task, editingTask, setEditingTask, updateTask, deleteTask, toggleComplete }) {
  const isEditing = editingTask?.id === task.id;

  if (isEditing) return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
      <input
        value={editingTask.title}
        onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
        className="w-full px-3 py-2 border rounded"
        placeholder="Title"
      />
      <textarea
        value={editingTask.description}
        onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
        className="w-full px-3 py-2 border rounded"
        placeholder="Description"
      />
      <div className="flex space-x-2 justify-end">
        <button onClick={() => setEditingTask(null)} className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
        <button onClick={() => updateTask(task.id, editingTask)} className="px-3 py-1 bg-slate-900 text-white rounded">Save</button>
      </div>
    </div>
  );

  return (
    <div className={`group p-4 rounded-xl border transition-all duration-200 ${task.completed ? 'bg-slate-50 border-slate-200' : 'bg-white border-gray-200 shadow-sm hover:shadow-md'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4 flex-1">
          <button onClick={() => toggleComplete(task)} className={`mt-1 transition-colors ${task.completed ? 'text-green-500' : 'text-gray-300 hover:text-slate-500'}`}>
            {task.completed ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
          </button>
          
          <div className="flex-1">
            <h3 className={`font-semibold text-lg ${task.completed ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{task.title}</h3>
            {task.description && (
               <div className="flex items-center text-sm text-gray-500 mt-1">
                 <Lock className="w-3 h-3 mr-1" />
                 {task.description}
               </div>
            )}
            <div className="text-xs text-gray-400 mt-2">
              Created: {new Date(task.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditingTask(task)} className="p-2 text-gray-400 hover:text-blue-600"><Edit2 className="w-4 h-4" /></button>
          <button onClick={() => deleteTask(task.id)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

function InputField({ value, onChange, placeholder, type = 'text', icon }) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        {icon}
      </div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none transition"
      />
    </div>
  );
}
