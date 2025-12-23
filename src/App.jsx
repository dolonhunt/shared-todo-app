import React, { useState, useEffect } from 'react';
import { Plus, Check, Trash2, Bell, Clock, User, Calendar, Download, X, StickyNote, CheckSquare, Lock, Users, Edit2, Save } from 'lucide-react';

// Fallback storage implementation using localStorage
const fallbackStorage = {
  async set(key, value, isShared = false) {
    try {
      const storageKey = isShared ? `shared_${key}` : `private_${key}`;
      localStorage.setItem(storageKey, value);
      return true;
    } catch (err) {
      console.error('localStorage set error:', err);
      return false;
    }
  },
  
  async get(key, isShared = false) {
    try {
      const storageKey = isShared ? `shared_${key}` : `private_${key}`;
      const value = localStorage.getItem(storageKey);
      return value ? { value } : null;
    } catch (err) {
      console.error('localStorage get error:', err);
      return null;
    }
  },
  
  async delete(key, isShared = false) {
    try {
      const storageKey = isShared ? `shared_${key}` : `private_${key}`;
      localStorage.removeItem(storageKey);
      return true;
    } catch (err) {
      console.error('localStorage delete error:', err);
      return false;
    }
  },
  
  async list(prefix, isShared = false) {
    try {
      const searchPrefix = isShared ? `shared_${prefix}` : `private_${prefix}`;
      const keys = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(searchPrefix)) {
          const originalKey = key.replace(isShared ? 'shared_' : 'private_', '');
          keys.push(originalKey);
        }
      }
      
      return { keys };
    } catch (err) {
      console.error('localStorage list error:', err);
      return { keys: [] };
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
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [itemType, setItemType] = useState('task');
  const [isPrivate, setIsPrivate] = useState(false);
  const [activeTab, setActiveTab] = useState('shared');
  const [editingNote, setEditingNote] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  const [storageReady, setStorageReady] = useState(false);
  const [storageType, setStorageType] = useState('none');

  // Check storage availability
  useEffect(() => {
    const checkStorage = async () => {
      if (typeof window !== 'undefined') {
        // Try custom storage API first
        if (window.storage) {
          try {
            await window.storage.set('test-key', 'test-value', false);
            await window.storage.get('test-key', false);
            await window.storage.delete('test-key', false);
            setStorageReady(true);
            setStorageType('custom');
            return;
          } catch (err) {
            console.error('Custom storage not working:', err);
          }
        }
        
        // Fallback to localStorage
        try {
          await fallbackStorage.set('test-key', 'test-value', false);
          await fallbackStorage.get('test-key', false);
          await fallbackStorage.delete('test-key', false);
          setStorageReady(true);
          setStorageType('localStorage');
        } catch (err) {
          console.error('localStorage not working:', err);
          setStorageReady(false);
        }
      } else {
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

  const getStorage = () => {
    return storageType === 'custom' ? window.storage : fallbackStorage;
  };

  const loadData = async () => {
    if (!storageReady) {
      setLoading(false);
      return;
    }

    try {
      const storage = getStorage();
      let allItems = [];
      
      try {
        const sharedItemsResult = await storage.list('item:', true);
        if (sharedItemsResult?.keys && sharedItemsResult.keys.length > 0) {
          for (const key of sharedItemsResult.keys) {
            try {
              const result = await storage.get(key, true);
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
        const privateItemsResult = await storage.list('item:', false);
        if (privateItemsResult?.keys && privateItemsResult.keys.length > 0) {
          for (const key of privateItemsResult.keys) {
            try {
              const result = await storage.get(key, false);
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
        const nameResult = await storage.get('userName', false);
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
      const storage = getStorage();
      const sharedResult = await storage.list('item:', true);
      const privateResult = await storage.list('item:', false);
      
      const allKeys = [
        ...(sharedResult?.keys || []).map(k => ({ key: k, shared: true })),
        ...(privateResult?.keys || []).map(k => ({ key: k, shared: false }))
      ];
      
      if (allKeys.length === 0) return;

      const now = Date.now();
      let needsReload = false;

      for (const { key, shared } of allKeys) {
        try {
          const result = await storage.get(key, shared);
          if (!result?.value) continue;
          
          const item = JSON.parse(result.value);
          
          if (item.type === 'task' && item.reminderTime && !item.completed && !item.notified) {
            const reminderTimestamp = new Date(item.reminderTime).getTime();
            if (now >= reminderTimestamp) {
              showNotification(item);
              item.notified = true;
              await storage.set(key, JSON.stringify(item), shared);
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
        const storage = getStorage();
        await storage.set('userName', name.trim(), false);
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
        const storage = getStorage();
        await storage.set(`item:${newItem.id}`, JSON.stringify(newItem), !itemIsPrivate);
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
        const storage = getStorage();
        await storage.set(`item:${id}`, JSON.stringify(updatedItem), !item.isPrivate);
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
        const storage = getStorage();
        await storage.set(`item:${currentItemId}`, JSON.stringify(updatedItem), !item.isPrivate);
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
        const storage = getStorage();
        await storage.set(`item:${id}`, JSON.stringify(updatedItem), !item.isPrivate);
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
        const storage = getStorage();
        await storage.set(`item:${id}`, JSON.stringify(updatedItem), !item.isPrivate);
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
        const storage = getStorage();
        await storage.delete(`item:${id}`, !item.isPrivate);
      } catch (err) {
        console.error('Error deleting item:', err);
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

  if (showNamePrompt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-600 p-4 rounded-full">
              <User className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-light text-center mb-2 text-gray-800" style={{fontFamily: 'system-ui, -apple-system, sans-serif'}}>Welcome</h2>
          <p className="text-center text-gray-500 text-sm mb-6">Enter your name to continue</p>
          {!storageReady && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-800 text-xs">⚠️ Storage not available. Data won't persist after reload.</p>
            </div>
          )}
          {storageReady && storageType === 'localStorage' && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-xs">ℹ️ Using localStorage for data persistence.</p>
            </div>
          )}
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && saveName(userName)}
            placeholder="Your name"
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 focus:outline-none mb-4"
          />
          <button
            onClick={() => saveName(userName)}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-indigo-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {showInstallBanner && (
        <div className="fixed top-0 left-0 right-0 bg-indigo-600 text-white p-3 z-50 shadow-lg">
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
                className="bg-white text-indigo-600 px-4 py-1.5 rounded-md text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Install
              </button>
              <button
                onClick={() => setShowInstallBanner(false)}
                className="text-white hover:bg-white/20 p-1.5 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {!storageReady && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-amber-800 text-sm">⚠️ Storage API is not available. Your data will not persist after reload.</p>
          </div>
        </div>
      )}

      {storageReady && storageType === 'localStorage' && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800 text-sm">ℹ️ Using localStorage for data persistence.</p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-indigo-600 px-4 py-5">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-light text-white tracking-wide" style={{fontFamily: 'Georgia, serif'}}>My Workspace</h1>
              <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full text-sm">
                <User className="w-4 h-4 text-white" />
                <span className="text-white font-medium">{userName}</span>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('shared')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  activeTab === 'shared'
                    ? 'bg-white text-indigo-600'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <Users className="w-4 h-4" />
                Shared
              </button>
              <button
                onClick={() => setActiveTab('private')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  activeTab === 'private'
                    ? 'bg-white text-indigo-600'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <Lock className="w-4 h-4" />
                Private
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setItemType('task')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    itemType === 'task'
                      ? 'bg-white text-indigo-600'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  Task
                </button>
                <button
                  onClick={() => setItemType('note')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    itemType === 'note'
                      ? 'bg-white text-indigo-600'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <StickyNote className="w-4 h-4" />
                  Note
                </button>
              </div>

              <div className="flex gap-2">
                {itemType === 'note' ? (
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Write your note..."
                    className="flex-1 px-4 py-2.5 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none text-sm"
                    rows="2"
                  />
                ) : (
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addItem()}
                    placeholder="Add a task..."
                    className="flex-1 px-4 py-2.5 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                  />
                )}
                <button
                  onClick={addItem}
                  className="bg-white text-indigo-600 p-2.5 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {['all', 'active', 'completed'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex-shrink-0 ${
                    filter === f
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No items yet</p>
                </div>
              ) : (
                filteredItems.map(item => (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-lg hover:shadow-md transition-shadow group ${
                      item.type === 'note' ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50 border border-gray-100'
                    }`}
                  >
                    {item.type === 'task' ? (
                      <button
                        onClick={() => toggleComplete(item.id)}
                        className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          item.completed
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-gray-300 hover:border-indigo-600'
                        }`}
                      >
                        {item.completed && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    ) : (
                      <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded bg-amber-500 flex items-center justify-center">
                        <StickyNote className="w-3 h-3 text-white" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      {editingNote === item.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            className="w-full px-3 py-2 rounded-md border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none resize-none text-sm"
                            rows="3"
                          />
                          <button
                            onClick={() => saveNote(item.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-md text-sm font-medium hover:bg-amber-600 transition-colors"
                          >
                            <Save className="w-3.5 h-3.5" />
                            Save
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className={`text-gray-800 text-sm break-words ${item.completed ? 'line-through opacity-50' : ''}`}>
                            {item.text}
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {item.type === 'task' && (
                              <select
                                value={item.priority}
                                onChange={(e) => updatePriority(item.id, e.target.value)}
                                className={`text-xs px-2 py-1 rounded-md font-medium border-0 ${getPriorityColor(item.priority)}`}
                              >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                              </select>
                            )}
                            
                            {item.reminderTime && !item.completed && (
                              <span className="text-xs px-2 py-1 bg-blue-500 text-white rounded-md flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(item.reminderTime).toLocaleString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
                              </span>
                            )}
                            
                            {item.isPrivate && (
                              <span className="text-xs px-2 py-1 bg-gray-600 text-white rounded-md flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Private
                              </span>
                            )}
                            
                            <span className="text-xs text-gray-500">{item.addedBy}</span>
                          </div>
                        </>
                      )}
                    </div>
                    
                    <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.type === 'note' && editingNote !== item.id && (
                        <button
                          onClick={() => {
                            setEditingNote(item.id);
                            setNoteContent(item.noteContent || item.text);
                          }}
                          className="text-amber-600 hover:text-amber-700 p-1"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {item.type === 'task' && (
                        <button
                          onClick={() => {
                            setCurrentItemId(item.id);
                            setShowReminderModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 p-1"
                        >
                          <Bell className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-red-500 hover:text-red-600 p-1"
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
      </div>

      {showReminderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-800">Set Reminder</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-sm"
                />
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowReminderModal(false);
                  setReminderDate('');
                  setReminderTime('');
                  setCurrentItemId(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={setReminder}
                disabled={!reminderDate || !reminderTime}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
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
