import React, { useState, useEffect } from 'react';
import {
  Plus, Check, Trash2, Bell, Clock, User, Calendar,
  Download, X, StickyNote, CheckSquare, Lock, Users, Edit2, Save
} from 'lucide-react';

/* ================= SAFE STORAGE ================= */
const safeStorage = {
  async get(key) {
    try {
      if (window.storage) {
        const r = await window.storage.get(key, false);
        return r?.value ?? null;
      }
      return localStorage.getItem(key);
    } catch {
      return localStorage.getItem(key);
    }
  },
  async set(key, value) {
    try {
      if (window.storage) {
        await window.storage.set(key, value, false);
      } else {
        localStorage.setItem(key, value);
      }
    } catch {
      localStorage.setItem(key, value);
    }
  },
  async remove(key) {
    try {
      if (window.storage) {
        await window.storage.delete(key, false);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
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

  /* =============== KILL OLD SW CACHE =============== */
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(regs => regs.forEach(r => r.unregister()))
        .catch(() => {});
    }
  }, []);

  /* ================= LOAD DATA ================= */
  useEffect(() => {
    const init = async () => {
      const name = await safeStorage.get('userName');
      if (name) {
        setUserName(name);
        setShowNamePrompt(false);
      }
      setLoading(false);
    };
    init();
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

    setItems(prev => [newItem, ...prev]);
    setInput('');
  };

  const toggleComplete = (id) => {
    setItems(items.map(i =>
      i.id === id ? { ...i, completed: !i.completed } : i
    ));
  };

  const deleteItem = (id) => {
    setItems(items.filter(i => i.id !== id));
  };

  const saveNote = (id) => {
    setItems(items.map(i =>
      i.id === id ? { ...i, text: noteContent, noteContent } : i
    ));
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
    return (
      <div className="min-h-screen flex items-center justify-center text-indigo-600">
        Loading…
      </div>
    );
  }

  /* ================= NAME PROMPT ================= */
  if (showNamePrompt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-6 rounded-xl shadow max-w-sm w-full">
          <div className="flex justify-center mb-4">
            <User className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-center text-xl mb-4">Enter your name</h2>
          <input
            value={userName}
            onChange={e => setUserName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveName()}
            className="w-full border rounded-lg px-3 py-2 mb-3"
            placeholder="Your name"
          />
          <button
            onClick={saveName}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  /* ================= MAIN UI ================= */
  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-4xl mx-auto">
      <div className="bg-indigo-600 rounded-xl p-4 text-white mb-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl">My Workspace</h1>
          <span className="flex items-center gap-2">
            <User className="w-4 h-4" /> {userName}
          </span>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setActiveTab('shared')}
            className={`px-3 py-1 rounded ${activeTab === 'shared' ? 'bg-white text-indigo-600' : 'bg-white/20'}`}
          >
            <Users className="inline w-4 h-4 mr-1" /> Shared
          </button>
          <button
            onClick={() => setActiveTab('private')}
            className={`px-3 py-1 rounded ${activeTab === 'private' ? 'bg-white text-indigo-600' : 'bg-white/20'}`}
          >
            <Lock className="inline w-4 h-4 mr-1" /> Private
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder={itemType === 'task' ? 'Add task…' : 'Write note…'}
            className="flex-1 px-3 py-2 rounded text-black"
          />
          <button onClick={addItem} className="bg-white text-indigo-600 p-2 rounded">
            <Plus />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {filteredItems.length === 0 && (
          <div className="text-center text-gray-400 py-10">
            <Calendar className="mx-auto mb-2 opacity-40" />
            No items yet
          </div>
        )}

        {filteredItems.map(item => (
          <div key={item.id} className="bg-white p-3 rounded-lg flex gap-3">
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
                    className="w-full border rounded p-2"
                  />
                  <button
                    onClick={() => saveNote(item.id)}
                    className="mt-2 text-sm bg-amber-500 text-white px-3 py-1 rounded"
                  >
                    <Save className="inline w-4 h-4 mr-1" /> Save
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
    </div>
  );
}
