import React, { useState, useEffect } from 'react';
import { Plus, Check, Trash2, Bell, Clock, User, Calendar, Download, X, StickyNote, CheckSquare, Lock, Users, Edit2, Save } from 'lucide-react';

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
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [itemType, setItemType] = useState('task');
  const [isPrivate, setIsPrivate] = useState(false);
  const [activeTab, setActiveTab] = useState('shared');
  const [editingNote, setEditingNote] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  const [storageReady, setStorageReady] = useState(false);

  // Check storage availability
  useEffect(() => {
    const checkStorage = async () => {
      if (typeof window !== 'undefined' && window.storage) {
        try {
          await window.storage.set('test-key', 'test-value', false);
          await window.storage.get('test-key', false);
          await window.storage.delete('test-key', false);
          setStorageReady(true);
        } catch (err) {
          console.error('Storage not working:', err);
          setStorageReady(false);
        }
      } else {
        console.error('window.storage not available');
        setStorageReady(false);
      }
    };
    checkStorage();
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBanner(false);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('Service Worker registration failed:', err);
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (storageReady) {
      loadData();
      checkReminders();
      const reminderInterval = setInterval(checkReminders, 30000);
      const syncInterval = setInterval(() => {
        loadData();
      }, 5000);
      return () => {
        clearInterval(reminderInterval);
        clearInterval(syncInterval);
      };
    } else {
      setLoading(false);
    }
  }, [storageReady]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const loadData = async () => {
    if (!storageReady) {
      setLoading(false);
      return;
    }

    try {
      let allItems = [];
      
      try {
        const sharedItemsResult = await window.storage.list('item:', true);
        if (sharedItemsResult?.keys && sharedItemsResult.keys.length > 0) {
          for (const key of sharedItemsResult.keys) {
            try {
              const result = await window.storage.get(key, true);
              if (result?.value) {
                const item = JSON.parse(result.value);
                allItems.push(item);
              }
            } catch (err) {
              console.error('Error loading shared item:', key, err);
            }
          }
        }
      } catch (err) {
        console.error('Error listing shared items:', err);
      }
      
      try {
        const privateItemsResult = await window.storage.list('item:', false);
        if (privateItemsResult?.keys && privateItemsResult.keys.length > 0) {
          for (const key of privateItemsResult.keys) {
            try {
              const result = await window.storage.get(key, false);
              if (result?.value) {
                const item = JSON.parse(result.value);
                allItems.push(item);
              }
            } catch (err) {
              console.error('Error loading private item:', key, err);
            }
          }
        }
      } catch (err) {
        console.error('Error listing private items:', err);
      }
      
      allItems.sort((a, b) => {
        if (a.priority !== b.priority) {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.priority] - order[b.priority];
        }
        return b.timestamp - a.timestamp;
      });
      
      setItems(allItems);
      
      try {
        const nameResult = await window.storage.get('userName', false);
        if (nameResult?.value) {
          setUserName(nameResult.value);
          setShowNamePrompt(false);
        }
      } catch (err) {
        console.error('Error loading username:', err);
      }
    } catch (err) {
      console.error('Load error:', err);
    }
    setLoading(false);
  };

  const checkReminders = async () => {
    if (!storageReady) return;

    try {
      const sharedResult = await window.storage.list('item:', true);
      const privateResult = await window.storage.list('item:', false);
      
      const allKeys = [
        ...(sharedResult?.keys || []).map(k => ({ key: k, shared: true })),
        ...(privateResult?.keys || []).map(k => ({ key: k, shared: false }))
      ];
      
      if (allKeys.length === 0) return;

      const now = Date.now();
      let needsReload = false;

      for (const { key, shared } of allKeys) {
        try {
          const result = await window.storage.get(key, shared);
          if (!result?.value) continue;
          
          const item = JSON.parse(result.value);
          
          if (item.type === 'task' && item.reminderTime && !item.completed && !item.notified) {
            const reminderTimestamp = new Date(item.reminderTime).getTime();
            if (now >= reminderTimestamp) {
              showNotification(item);
              item.notified = true;
              await window.storage.set(key, JSON.stringify(item), shared);
              needsReload = true;
            }
          }
        } catch (err) {
          console.error('Error checking reminder:', key, err);
        }
      }
      
      if (needsReload) {
        await loadData();
      }
    } catch (err) {
      console.error('Reminder check error:', err);
    }
  };

  const showNotification = (item) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('Task Reminder', {
        body: item.text,
        icon: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png',
        tag: item.id,
        requireInteraction: true,
        vibrate: [200, 100, 200]
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  };

  const saveName = async (name) => {
    if (!name.trim()) return;
    
    setUserName(name.trim());
    setShowNamePrompt(false);
    
    if (storageReady) {
      try {
        await window.storage.set('userName', name.trim(), false);
      } catch (err) {
        console.error('Error saving username:', err);
      }
    }
  };

  const addItem = async () => {
    if (!input.trim() || !userName) return;
    
    const itemIsPrivate = activeTab === 'private' || isPrivate;
    
    const newItem = {
      id: Date.now().toString(),
      text: input.trim(),
      type: itemType,
      completed: false,
      timestamp: Date.now(),
      addedBy: userName,
      priority: 'medium',
      reminderTime: null,
      notified: false,
      isPrivate: itemIsPrivate,
      noteContent: itemType === 'note' ? input.trim() : ''
    };
    
    setItems([newItem, ...items]);
    setInput('');
    setIsPrivate(false);
    
    if (storageReady) {
      try {
        await window.storage.set(`item:${newItem.id}`, JSON.stringify(newItem), !itemIsPrivate);
      } catch (err) {
        console.error('Error saving item:', err);
      }
    }
  };

  const saveNote = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const updatedItem = { ...item, text: noteContent, noteContent: noteContent };
    
    setItems(items.map(i => i.id === id ? updatedItem : i));
    setEditingNote(null);
    setNoteContent('');
    
    if (storageReady) {
      try {
        await window.storage.set(`item:${id}`, JSON.stringify(updatedItem), !item.isPrivate);
      } catch (err) {
        console.error('Error saving note:', err);
      }
    }
  };

  const setReminder = async () => {
    if (!reminderDate || !reminderTime) return;
    
    const reminderTimestamp = new Date(`${reminderDate}T${reminderTime}`);
    const item = items.find(i => i.id === currentItemId);
    if (!item) return;
    
    const updatedItem = { 
      ...item, 
      reminderTime: reminderTimestamp.toISOString(), 
      notified: false 
    };
    
    setItems(items.map(i => i.id === currentItemId ? updatedItem : i));
    setShowReminderModal(false);
    setReminderDate('');
    setReminderTime('');
    setCurrentItemId(null);
    
    if (storageReady) {
      try {
        await window.storage.set(`item:${currentItemId}`, JSON.stringify(updatedItem), !item.isPrivate);
      } catch (err) {
        console.error('Error setting reminder:', err);
      }
    }
  };

  const updatePriority = async (id, newPriority) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const updatedItem = { ...item, priority: newPriority };
    
    setItems(items.map(i => i.id === id ? updatedItem : i));
    
    if (storageReady) {
      try {
        await window.storage.set(`item:${id}`, JSON.stringify(updatedItem), !item.isPrivate);
      } catch (err) {
        console.error('Error updating priority:', err);
      }
    }
  };

  const toggleComplete = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const updatedItem = { ...item, completed: !item.completed };
    
    setItems(items.map(i => i.id === id ? updatedItem : i));
    
    if (storageReady) {
      try {
        await window.storage.set(`item:${id}`, JSON.stringify(updatedItem), !item.isPrivate);
      } catch (err) {
        console.error('Error toggling complete:', err);
      }
    }
  };

  const deleteItem = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    setItems(items.filter(i => i.id !== id));
    
    if (storageReady) {
      try {
        await window.storage.delete(`item:${id}`, !item.isPrivate);
      } catch (err) {
        console.error('Error deleting item:', err);
      }
    }
  };

  const clearReminder = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const updatedItem = { ...item, reminderTime: null, notified: false };
    
    setItems(items.map(i => i.id === id ? updatedItem : i));
    
    if (storageReady) {
      try {
        await window.storage.set(`item:${id}`, JSON.stringify(updatedItem), !item.isPrivate);
      } catch (err) {
        console.error('Error clearing reminder:', err);
      }
    }
  };

  const filteredItems = items.filter(item => {
    const matchesTab = activeTab === 'shared' ? !item.isPrivate : item.isPrivate;
    if (filter === 'active') return !item.completed && matchesTab;
    if (filter === 'completed') return item.completed && matchesTab;
    return matchesTab;
  });

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return 'bg-red-500 text-white';
      case 'medium': return 'bg-amber-500 text-white';
      case 'low': return 'bg-emerald-500 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  const getStats = () => {
    const tabItems = items.filter(item => 
      activeTab === 'shared' ? !item.isPrivate : item.isPrivate
    );
    const tasks = tabItems.filter(i => i.type === 'task');
    const notes = tabItems.filter(i => i.type === 'note');
    const completedTasks = tasks.filter(i => i.completed);
    const pendingReminders = tasks.filter(i => i.reminderTime && !i.completed && !i.notified);
    
    return {
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      totalNotes: notes.length,
      pendingReminders: pendingReminders.length
    };
  };

  const stats = getStats();

  if (showNamePrompt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full border border-gray-100">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-full shadow-lg">
              <User className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-semibold text-center mb-2 text-gray-800" style={{fontFamily: 'system-ui, -apple-system, sans-serif'}}>Welcome</h2>
          <p className="text-center text-gray-500 text-sm mb-6">Enter your name to get started</p>
          {!storageReady && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 text-xs">⚠️ Storage not available. Data won't persist after reload.</p>
            </div>
          )}
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && saveName(userName)}
            placeholder="Your name"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none mb-4 transition-all"
          />
          <button
            onClick={() => saveName(userName)}
            disabled={!userName.trim()}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-indigo-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-6">
      {showInstallBanner && (
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-3 z-50 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-3 min-w-0">
              <Download className="w-5 h-5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm">Install App</p>
                <p className="text-xs opacity-90">Better notifications & offline access</p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={handleInstallClick}
                className="bg-white text-indigo-600 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors shadow"
              >
                Install
              </button>
              <button
                onClick={() => setShowInstallBanner(false)}
                className="text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {!storageReady && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 shadow-sm">
            <p className="text-amber-800 text-sm flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              Storage API is not available. Your data will not persist after reload.
            </p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-6">
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-2xl font-bold text-white tracking-wide" style={{fontFamily: 'system-ui, -apple-system, sans-serif'}}>
                My Workspace
              </h1>
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm">
                <User className="w-4 h-4 text-white" />
                <span className="text-white font-medium">{userName}</span>
              </div>
            </div>

            {/* Tab Buttons */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setActiveTab('shared')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  activeTab === 'shared'
                    ? 'bg-white text-indigo-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <Users className="w-4 h-4" />
                Shared
              </button>
              <button
                onClick={() => setActiveTab('private')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  activeTab === 'private'
                    ? 'bg-white text-indigo-600 shadow-lg'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <Lock className="w-4 h-4" />
                Private
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{stats.totalTasks}</p>
                <p className="text-xs text-white/80">Tasks</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{stats.completedTasks}</p>
                <p className="text-xs text-white/80">Done</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{stats.totalNotes}</p>
                <p className="text-xs text-white/80">Notes</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{stats.pendingReminders}</p>
                <p className="text-xs text-white/80">Reminders</p>
              </div>
            </div>
            
            {/* Item Type Toggle */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setItemType('task')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    itemType === 'task'
                      ? 'bg-white text-indigo-600 shadow-lg'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  Task
                </button>
                <button
                  onClick={() => setItemType('note')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    itemType === 'note'
                      ? 'bg-white text-indigo-600 shadow-lg'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <StickyNote className="w-4 h-4" />
                  Note
                </button>
              </div>

              {/* Input Area */}
              <div className="flex gap-2">
                {itemType === 'note' ? (
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Write your note..."
                    className="flex-1 px-4 py-3 rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none text-sm shadow-inner"
                    rows="2"
                  />
                ) : (
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addItem()}
                    placeholder="Add a task..."
                    className="flex-1 px-4 py-3 rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm shadow-inner"
                  />
                )}
                <button
                  onClick={addItem}
                  disabled={!input.trim()}
                  className="bg-white text-indigo-600 p-3 rounded-xl hover:bg-gray-50 transition-all flex-shrink-0 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-4">
            {/* Filter Buttons */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {['all', 'active', 'completed'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${
                    filter === f
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Items List */}
            <div className="space-y-3">
              {filteredItems.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 opacity-50" />
                  </div>
                  <p className="text-sm font-medium">No items yet</p>
                  <p className="text-xs mt-1">Add a task or note to get started</p>
                </div>
              ) : (
                filteredItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-4 rounded-xl hover:shadow-lg transition-all group border ${
                      item.type === 'note' 
                        ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200' 
                        : item.completed 
                          ? 'bg-gray-50 border-gray-200' 
                          : 'bg-white border-gray-100 shadow-sm'
                    }`}
                  >
                    {item.type === 'task' ? (
                      <button
                        onClick={() => toggleComplete(item.id)}
                        className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          item.completed
                            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 border-indigo-500 shadow-md'
                            : 'border-gray-300 hover:border-indigo-500 hover:bg-indigo-50'
                        }`}
                      >
                        {item.completed && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ) : (
                      <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
                        <StickyNote className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      {editingNote === item.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none resize-none text-sm"
                            rows="4"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveNote(item.id)}
                              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-sm font-medium hover:from-amber-600 hover:to-orange-600 transition-all shadow-md"
                            >
                              <Save className="w-4 h-4" />
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingNote(null);
                                setNoteContent('');
                              }}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className={`text-gray-800 text-sm break-words leading-relaxed ${item.completed ? 'line-through opacity-50' : ''}`}>
                            {item.text}
                          </p>
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            {item.type === 'task' && (
                              <select
                                value={item.priority}
                                onChange={(e) => updatePriority(item.id, e.target.value)}
                                className={`text-xs px-2.5 py-1 rounded-lg font-medium border-0 cursor-pointer ${getPriorityColor(item.priority)}`}
                              >
                                <option value="high">🔴 High</option>
                                <option value="medium">🟡 Medium</option>
                                <option value="low">🟢 Low</option>
                              </select>
                            )}
                            
                            {item.reminderTime && !item.completed && (
                              <span className="text-xs px-2.5 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg flex items-center gap-1 shadow-sm">
                                <Clock className="w-3 h-3" />
                                {new Date(item.reminderTime).toLocaleString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
                                <button
                                  onClick={() => clearReminder(item.id)}
                                  className="ml-1 hover:bg-white/20 rounded p-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            )}
                            
                            {item.isPrivate && (
                              <span className="text-xs px-2.5 py-1 bg-gray-700 text-white rounded-lg flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Private
                              </span>
                            )}
                            
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {item.addedBy}
                            </span>
                            
                            <span className="text-xs text-gray-400">
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.type === 'note' && editingNote !== item.id && (
                        <button
                          onClick={() => {
                            setEditingNote(item.id);
                            setNoteContent(item.noteContent || item.text);
                          }}
                          className="text-amber-600 hover:text-amber-700 p-2 hover:bg-amber-100 rounded-lg transition-all"
                          title="Edit note"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {item.type === 'task' && !item.completed && (
                        <button
                          onClick={() => {
                            setCurrentItemId(item.id);
                            setShowReminderModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-100 rounded-lg transition-all"
                          title="Set reminder"
                        >
                          <Bell className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-red-500 hover:text-red-600 p-2 hover:bg-red-100 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-gray-400 text-xs">
          <p>Shared Productivity App • {new Date().getFullYear()}</p>
        </div>
      </div>

      {/* Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-xl shadow-lg">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Set Reminder</h3>
                <p className="text-sm text-gray-500">Get notified at your chosen time</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none text-sm transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none text-sm transition-all"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowReminderModal(false);
                  setReminderDate('');
                  setReminderTime('');
                  setCurrentItemId(null);
                }}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={setReminder}
                disabled={!reminderDate || !reminderTime}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
              >
                Set Reminder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
