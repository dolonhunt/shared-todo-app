import React, { useState, useEffect } from 'react';
import {
  Plus, Check, Trash2, Bell, Clock, User, Calendar,
  Download, X, StickyNote, CheckSquare, Lock, Users, Edit2, Save
} from 'lucide-react';

/* ================= SAFE STORAGE ================= */
const safeStorage = {
  async list(prefix) {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
    return keys.map(k => JSON.parse(localStorage.getItem(k)));
  },
  async get(key) {
    return localStorage.getItem(key);
  },
  async set(key, value) {
    localStorage.setItem(key, value);
  },
  async remove(key) {
    localStorage.removeItem(key);
  }
};

export default function SharedProductivityApp() {
  const [items, setItems] = useState([]);
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState('all');
  const [userName, setUserName] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(true);
  const [loading, setLoading] = useState(true);

  const [showReminderModal, setShowReminderModal] = useState(false);
  const [currentItemId, setCurrentItemId] = useState(null);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');

  const [itemType, setItemType] = useState('task');
  const [activeTab, setActiveTab] = useState('shared');
  const [editingNote, setEditingNote] = useState(null);
  const [noteContent, setNoteContent] = useState('');

  /* ============ DISABLE BROKEN SERVICE WORKER ============ */
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(r => r.forEach(sw => sw.unregister()))
        .catch(() => {});
    }
  }, []);

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    const load = async () => {
      const name = await safeStorage.get('userName');
      if (name) {
        setUserName(name);
        setShowNamePrompt(false);
      }

      const storedItems = await safeStorage.list('item:');
      if (storedItems.length) {
        setItems(storedItems.sort((a, b) => b.timestamp - a.timestamp));
      }

      setLoading(false);
    };
    load();
  }, []);

  const saveName = async () => {
    if (!userName.trim()) return;
    await safeStorage.set('userName', userName.trim());
    setShowNamePrompt(false);
  };

  const addItem = async () => {
    if (!input.trim() || !userName) return;

    const newItem = {
      id: Date.now().toString(),
      text: input.trim(),
      type: itemType,
      completed: false,
      timestamp: Date.now(),
      addedBy: userName,
      priority: 'medium',
      reminderTime: null,
      isPrivate: activeTab === 'private',
      noteContent: itemType === 'note' ? input.trim() : ''
    };

    await safeStorage.set(`item:${newItem.id}`, JSON.stringify(newItem));
    setItems(prev => [newItem, ...prev]);
    setInput('');
  };

  const toggleComplete = async (id) => {
    const updated = items.map(i =>
      i.id === id ? { ...i, completed: !i.completed } : i
    );
    setItems(updated);
    await safeStorage.set(`item:${id}`, JSON.stringify(updated.find(i => i.id === id)));
  };

  const deleteItem = async (id) => {
    setItems(items.filter(i => i.id !== id));
    await safeStorage.remove(`item:${id}`);
  };

  const saveNote = async (id) => {
    const updated = items.map(i =>
      i.id === id ? { ...i, text: noteContent, noteContent } : i
    );
    setItems(updated);
    await safeStorage.set(`item:${id}`, JSON.stringify(updated.find(i => i.id === id)));
    setEditingNote(null);
    setNoteContent('');
  };

  const filteredItems = items.filter(item => {
    const tabOk = activeTab === 'shared' ? !item.isPrivate : item.isPrivate;
    if (filter === 'active') return !item.completed && tabOk;
    if (filter === 'completed') return item.completed && tabOk;
    return tabOk;
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  if (showNamePrompt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-6 rounded-xl shadow w-full max-w-sm">
          <User className="mx-auto mb-4 text-indigo-600" size={36} />
          <input
            value={userName}
            onChange={e => setUserName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveName()}
            className="w-full border px-3 py-2 rounded mb-3"
            placeholder="Your name"
          />
          <button onClick={saveName} className="w-full bg-indigo-600 text-white py-2 rounded">
            Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-4xl mx-auto">
      <h1 className="text-xl mb-4">My Workspace ({userName})</h1>

      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          className="flex-1 border px-3 py-2 rounded"
          placeholder="Add task or note"
        />
        <button onClick={addItem} className="bg-indigo-600 text-white px-3 rounded">
          <Plus />
        </button>
      </div>

      {filteredItems.map(item => (
        <div key={item.id} className="bg-white p-3 rounded mb-2 flex gap-2">
          {item.type === 'task' && (
            <button onClick={() => toggleComplete(item.id)}>
              {item.completed ? <Check /> : <CheckSquare />}
            </button>
          )}

          <div className="flex-1">
            {editingNote === item.id ? (
              <>
                <textarea
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                  className="w-full border p-2"
                />
                <button onClick={() => saveNote(item.id)} className="text-sm mt-1">
                  Save
                </button>
              </>
            ) : (
              <p className={item.completed ? 'line-through opacity-50' : ''}>
                {item.text}
              </p>
            )}
          </div>

          <button onClick={() => deleteItem(item.id)} className="text-red-500">
            <Trash2 />
          </button>
        </div>
      ))}
    </div>
  );
}
