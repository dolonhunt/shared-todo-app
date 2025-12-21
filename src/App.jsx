import React, { useState, useEffect } from 'react';
import { Plus, Check, Trash2, Bell, Clock, User, Calendar, Download, X } from 'lucide-react';

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

  const loadData = () => {
    try {
      const storedItems = localStorage.getItem('sharedItems');
      const storedName = localStorage.getItem('userName');
      
      if (storedItems) {
        const parsedItems = JSON.parse(storedItems);
        parsedItems.sort((a, b) => {
          if (a.priority !== b.priority) {
            const order = { high: 0, medium: 1, low: 2 };
            return order[a.priority] - order[b.priority];
          }
          return b.timestamp - a.timestamp;
        });
        setItems(parsedItems);
      }
      
      if (storedName) {
        setUserName(storedName);
        setShowNamePrompt(false);
      }
    } catch (err) {
      console.error('Load error:', err);
    }
    setLoading(false);
  };

  const saveData = (itemsToSave) => {
    try {
      localStorage.setItem('sharedItems', JSON.stringify(itemsToSave));
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const checkReminders = () => {
    try {
      const storedItems = localStorage.getItem('sharedItems');
      if (!storedItems) return;

      const parsedItems = JSON.parse(storedItems);
      const now = Date.now();
      let updated = false;

      parsedItems.forEach(item => {
        if (item.reminderTime && !item.completed && !item.notified) {
          const reminderTimestamp = new Date(item.reminderTime).getTime();
          if (now >= reminderTimestamp) {
            showNotification(item);
            item.notified = true;
            updated = true;
          }
        }
      });

      if (updated) {
        localStorage.setItem('sharedItems', JSON.stringify(parsedItems));
        loadData();
      }
    } catch (err) {
      console.error('Reminder check error:', err);
    }
  };

  const showNotification = (item) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('📋 Task Reminder', {
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

  const saveName = (name) => {
    if (!name.trim()) return;
    try {
      localStorage.setItem('userName', name.trim());
      setUserName(name.trim());
      setShowNamePrompt(false);
    } catch (err) {
      console.error('Save name error:', err);
    }
  };

  const addItem = () => {
    if (!input.trim() || !userName) return;
    
    const newItem = {
      id: Date.now().toString(),
      text: input.trim(),
      completed: false,
      timestamp: Date.now(),
      addedBy: userName,
      priority: 'medium',
      reminderTime: null,
      notified: false
    };
    
    const updatedItems = [newItem, ...items];
    setItems(updatedItems);
    saveData(updatedItems);
    setInput('');
  };

  const setReminder = () => {
    if (!reminderDate || !reminderTime) return;
    
    const reminderTimestamp = new Date(`${reminderDate}T${reminderTime}`);
    const updated = items.map(item => 
      item.id === currentItemId 
        ? { ...item, reminderTime: reminderTimestamp.toISOString(), notified: false }
        : item
    );
    
    setItems(updated);
    saveData(updated);
    setShowReminderModal(false);
    setReminderDate('');
    setReminderTime('');
    setCurrentItemId(null);
  };

  const updatePriority = (id, newPriority) => {
    const updated = items.map(item => 
      item.id === id ? { ...item, priority: newPriority } : item
    );
    setItems(updated);
    saveData(updated);
  };

  const toggleComplete = (id) => {
    const updated = items.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setItems(updated);
    saveData(updated);
  };

  const deleteItem = (id) => {
    const updated = items.filter(item => item.id !== id);
    setItems(updated);
    saveData(updated);
  };

  const filteredItems = items.filter(item => {
    if (filter === 'active') return !item.completed;
    if (filter === 'completed') return item.completed;
    return true;
  });

  const getPriorityBadge = (priority) => {
    switch(priority) {
      case 'high': return 'bg-gradient-to-r from-red-400 to-pink-400 text-white';
      case 'medium': return 'bg-gradient-to-r from-amber-400 to-yellow-400 text-white';
      case 'low': return 'bg-gradient-to-r from-emerald-400 to-green-400 text-white';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (showNamePrompt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full backdrop-blur-sm bg-white/90">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 p-5 rounded-full shadow-lg">
              <User className="w-10 h-10 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-center mb-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">Welcome!</h2>
          <p className="text-center text-gray-600 mb-8">Let's get started with your name ✨</p>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && saveName(userName)}
            placeholder="Your beautiful name..."
            className="w-full px-5 py-4 rounded-2xl border-2 border-violet-200 focus:border-violet-400 focus:outline-none mb-6 text-lg"
            autoFocus
          />
          <button
            onClick={() => saveName(userName)}
            className="w-full bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-white py-4 rounded-2xl font-semibold hover:shadow-2xl hover:scale-105 transition-all duration-300"
          >
            Start My Journey 🚀
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-bounce mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full mx-auto"></div>
          </div>
          <p className="text-violet-600 text-lg font-medium">Loading your space...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-fuchsia-100 p-4 md:p-8 pb-20">
      {showInstallBanner && (
        <div className="fixed top-4 left-4 right-4 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white p-4 rounded-3xl shadow-2xl z-50 animate-slide-down backdrop-blur-lg bg-opacity-95">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Download className="w-7 h-7 flex-shrink-0 animate-bounce" />
              <div>
                <p className="font-bold">Install Our App! 🎉</p>
                <p className="text-sm opacity-90">Better notifications & offline magic</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="bg-white text-violet-600 px-5 py-2 rounded-xl text-sm font-bold hover:bg-gray-100 transition-all shadow-lg"
              >
                Install
              </button>
              <button
                onClick={() => setShowInstallBanner(false)}
                className="text-white hover:bg-white/20 p-2 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/50">
          <div className="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-4xl font-black text-white mb-1">Shared To-Do ✨</h1>
                <p className="text-white/90 text-sm">Organize together, achieve more!</p>
              </div>
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-5 py-2 rounded-full border border-white/30">
                <User className="w-4 h-4 text-white" />
                <span className="text-white font-semibold">{userName}</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addItem()}
                placeholder="Add a task... 🎯"
                className="flex-1 px-5 py-4 rounded-2xl border-0 focus:outline-none focus:ring-4 focus:ring-white/50 shadow-lg"
              />
              <button
                onClick={addItem}
                className="bg-white text-violet-600 p-4 rounded-2xl hover:bg-gray-50 transition-all shadow-lg hover:scale-110"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex gap-2 mb-6 flex-wrap">
              {['all', 'active', 'completed'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-5 py-2 rounded-xl font-semibold transition-all ${
                    filter === f
                      ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg scale-105'
                      : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 hover:shadow-md hover:scale-105'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {filteredItems.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <div className="bg-gradient-to-br from-violet-100 to-fuchsia-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-12 h-12 text-violet-400" />
                  </div>
                  <p className="text-lg font-medium text-gray-500">No items yet! 🌟</p>
                  <p className="text-sm text-gray-400">Create your first task above</p>
                </div>
              ) : (
                filteredItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 p-5 bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200 rounded-2xl hover:shadow-xl transition-all group"
                  >
                    <button
                      onClick={() => toggleComplete(item.id)}
                      className={`mt-1 flex-shrink-0 w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${
                        item.completed
                          ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 border-transparent shadow-lg'
                          : 'border-violet-300 hover:border-violet-500 hover:scale-110'
                      }`}
                    >
                      {item.completed && <Check className="w-5 h-5 text-white" />}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <p className={`text-gray-800 break-words text-lg ${item.completed ? 'line-through opacity-50' : ''}`}>
                        {item.text}
                      </p>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <select
                          value={item.priority}
                          onChange={(e) => updatePriority(item.id, e.target.value)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-bold shadow-md ${getPriorityBadge(item.priority)}`}
                        >
                          <option value="high">🔥 High</option>
                          <option value="medium">⚡ Medium</option>
                          <option value="low">🌱 Low</option>
                        </select>
                        
                        {item.reminderTime && !item.completed && (
                          <span className="text-xs px-3 py-1.5 bg-gradient-to-r from-blue-400 to-cyan-400 text-white rounded-lg flex items-center gap-1 font-medium shadow-md">
                            <Clock className="w-3 h-3" />
                            {new Date(item.reminderTime).toLocaleString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                        
                        <span className="text-xs text-gray-500 font-medium">{item.addedBy}</span>
                        <span className="text-xs text-gray-300">•</span>
                        <span className="text-xs text-gray-500">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => {
                          setCurrentItemId(item.id);
                          setShowReminderModal(true);
                        }}
                        className="text-blue-500 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                      >
                        <Bell className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600 font-medium">
          <p>✨ Works on all devices • Smart reminders • Beautiful design 🎉</p>
        </div>
      </div>

      {showReminderModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-blue-400 to-cyan-400 p-3 rounded-2xl shadow-lg">
                <Bell className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Set Reminder</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">📅 Date</label>
                <input
                  type="date"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-5 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:outline-none text-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">⏰ Time</label>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full px-5 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-400 focus:outline-none text-lg"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => {
                  setShowReminderModal(false);
                  setReminderDate('');
                  setReminderTime('');
                  setCurrentItemId(null);
                }}
                className="flex-1 px-5 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={setReminder}
                className="flex-1 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold hover:shadow-xl transition-all hover:scale-105"
              >
                Set Reminder 🔔
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
