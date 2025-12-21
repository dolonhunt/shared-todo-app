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
    loadData();
    checkReminders();
    const interval = setInterval(checkReminders, 30000);
    return () => clearInterval(interval);
  }, []);

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
    // Check if storage API is available
    if (!window.storage) {
      console.error('Storage API not available');
      setLoading(false);
      return;
    }

    try {
      let allItems = [];
      
      // Load shared items
      try {
        const sharedItemsResult = await window.storage.list('item:', true);
        console.log('Shared items result:', sharedItemsResult);
        if (sharedItemsResult?.keys && sharedItemsResult.keys.length > 0) {
          const sharedPromises = sharedItemsResult.keys.map(key => 
            window.storage.get(key, true).catch(err => {
              console.log('Error getting shared key:', key, err);
              return null;
            })
          );
          const sharedResults = await Promise.all(sharedPromises);
          const sharedItems = sharedResults
            .filter(r => r?.value)
            .map(r => {
              try {
                const parsed = JSON.parse(r.value);
                console.log('Loaded shared item:', parsed);
                return parsed;
              } catch {
                return null;
              }
            })
            .filter(item => item !== null);
          allItems = [...allItems, ...sharedItems];
        }
      } catch (err) {
        console.log('No shared items found:', err);
      }
      
      // Load private items
      try {
        const privateItemsResult = await window.storage.list('item:', false);
        console.log('Private items result:', privateItemsResult);
        if (privateItemsResult?.keys && privateItemsResult.keys.length > 0) {
          const privatePromises = privateItemsResult.keys.map(key => 
            window.storage.get(key, false).catch(err => {
              console.log('Error getting private key:', key, err);
              return null;
            })
          );
          const privateResults = await Promise.all(privatePromises);
          const privateItems = privateResults
            .filter(r => r?.value)
            .map(r => {
              try {
                const parsed = JSON.parse(r.value);
                console.log('Loaded private item:', parsed);
                return parsed;
              } catch {
                return null;
              }
            })
            .filter(item => item !== null);
          allItems = [...allItems, ...privateItems];
        }
      } catch (err) {
        console.log('No private items found:', err);
      }
      
      console.log('Total items loaded:', allItems.length);
      
      // Sort items
      allItems.sort((a, b) => {
        if (a.priority !== b.priority) {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.priority] - order[b.priority];
        }
        return b.timestamp - a.timestamp;
      });
      
      setItems(allItems);
      
      // Load username
      try {
        const nameResult = await window.storage.get('userName', false);
        console.log('Username result:', nameResult);
        if (nameResult?.value) {
          setUserName(nameResult.value);
          setShowNamePrompt(false);
        }
      } catch (err) {
        console.log('No username found:', err);
      }
    } catch (err) {
      console.error('Load error:', err);
    }
    setLoading(false);
  };

  const checkReminders = async () => {
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
          console.log(`Could not check reminder for ${key}`);
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
    
    if (!window.storage) {
      console.error('Storage API not available');
      setUserName(name.trim());
      setShowNamePrompt(false);
      return;
    }
    
    try {
      const result = await window.storage.set('userName', name.trim(), false);
      console.log('Save name result:', result);
      setUserName(name.trim());
      setShowNamePrompt(false);
    } catch (err) {
      console.error('Save name error:', err);
      // Even if storage fails, allow user to proceed
      setUserName(name.trim());
      setShowNamePrompt(false);
    }
  };

  const addItem = async () => {
    if (!input.trim() || !userName) return;
    
    if (!window.storage) {
      console.error('Storage API not available');
      return;
    }
    
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
    
    console.log('Adding item:', newItem, 'Shared:', !itemIsPrivate);
    
    try {
      const result = await window.storage.set(`item:${newItem.id}`, JSON.stringify(newItem), !itemIsPrivate);
      console.log('Storage set result:', result);
      setItems([newItem, ...items]);
      setInput('');
      setIsPrivate(false);
    } catch (err) {
      console.error('Add error:', err);
      // Still add to UI even if storage fails
      setItems([newItem, ...items]);
      setInput('');
      setIsPrivate(false);
    }
  };

  const saveNote = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const updatedItem = { ...item, text: noteContent, noteContent: noteContent };
    
    try {
      await window.storage.set(`item:${id}`, JSON.stringify(updatedItem), !item.isPrivate);
      setItems(items.map(i => i.id === id ? updatedItem : i));
      setEditingNote(null);
      setNoteContent('');
    } catch (err) {
      console.error('Save note error:', err);
      setItems(items.map(i => i.id === id ? updatedItem : i));
      setEditingNote(null);
      setNoteContent('');
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
    
    try {
      await window.storage.set(`item:${currentItemId}`, JSON.stringify(updatedItem), !item.isPrivate);
      setItems(items.map(i => i.id === currentItemId ? updatedItem : i));
      setShowReminderModal(false);
      setReminderDate('');
      setReminderTime('');
      setCurrentItemId(null);
    } catch (err) {
      console.error('Reminder error:', err);
      setItems(items.map(i => i.id === currentItemId ? updatedItem : i));
      setShowReminderModal(false);
      setReminderDate('');
      setReminderTime('');
      setCurrentItemId(null);
    }
  };

  const updatePriority = async (id, newPriority) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const updatedItem = { ...item, priority: newPriority };
    
    // Update UI immediately
    setItems(items.map(i => i.id === id ? updatedItem : i));
    
    // Try to save to storage in background
    try {
      await window.storage.set(`item:${id}`, JSON.stringify(updatedItem), !item.isPrivate);
    } catch (err) {
      console.error('Priority update error:', err);
    }
  };

  const toggleComplete = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    const updatedItem = { ...item, completed: !item.completed };
    
    // Update UI immediately
    setItems(items.map(i => i.id === id ? updatedItem : i));
    
    // Try to save to storage in background
    try {
      await window.storage.set(`item:${id}`, JSON.stringify(updatedItem), !item.isPrivate);
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  const deleteItem = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    // Update UI immediately
    setItems(items.filter(i => i.id !== id));
    
    // Try to delete from storage in background
    try {
      await window.storage.delete(`item:${id}`, !item.isPrivate);
    } catch (err) {
      console.error('Delete error:', err);
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
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowReminderModal(false);
                  setReminderDate('');
                  setReminderTime('');
                  setCurrentItemId(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={setReminder}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors text-sm"
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
