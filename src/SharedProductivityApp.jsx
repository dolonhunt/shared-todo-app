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
    try {
      const [sharedItemsResult, privateItemsResult, nameResult] = await Promise.all([
        window.storage.list('item:', true).catch(() => null),
        window.storage.list('item:', false).catch(() => null),
        window.storage.get('userName', false).catch(() => null)
      ]);
      
      let allItems = [];
      
      if (sharedItemsResult?.keys) {
        const sharedPromises = sharedItemsResult.keys.map(key => 
          window.storage.get(key, true).catch(() => null)
        );
        const sharedResults = await Promise.all(sharedPromises);
        const sharedItems = sharedResults
          .filter(r => r?.value)
          .map(r => JSON.parse(r.value));
        allItems = [...allItems, ...sharedItems];
      }
      
      if (privateItemsResult?.keys) {
        const privatePromises = privateItemsResult.keys.map(key => 
          window.storage.get(key, false).catch(() => null)
        );
        const privateResults = await Promise.all(privatePromises);
        const privateItems = privateResults
          .filter(r => r?.value)
          .map(r => JSON.parse(r.value));
        allItems = [...allItems, ...privateItems];
      }
      
      allItems.sort((a, b) => {
        if (a.priority !== b.priority) {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.priority] - order[b.priority];
        }
        return b.timestamp - a.timestamp;
      });
      
      setItems(allItems);
      
      if (nameResult?.value) {
        setUserName(nameResult.value);
        setShowNamePrompt(false);
      }
    } catch (err) {
      console.error('Load error:', err);
    }
    setLoading(false);
  };

  const checkReminders = async () => {
    try {
      const result = await window.storage.list('item:', true);
      if (!result?.keys) return;

      const itemPromises = result.keys.map(key => window.storage.get(key, true));
      const itemResults = await Promise.all(itemPromises);
      const now = Date.now();

      for (const r of itemResults) {
        if (!r?.value) continue;
        const item = JSON.parse(r.value);
        
        if (item.reminderTime && !item.completed && !item.notified) {
          const reminderTimestamp = new Date(item.reminderTime).getTime();
          if (now >= reminderTimestamp) {
            showNotification(item);
            item.notified = true;
            await window.storage.set(`item:${item.id}`, JSON.stringify(item), true);
          }
        }
      }
      
      await loadData();
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
    try {
      await window.storage.set('userName', name.trim(), false);
      setUserName(name.trim());
      setShowNamePrompt(false);
    } catch (err) {
      console.error('Save name error:', err);
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
    
    try {
      await window.storage.set(`item:${newItem.id}`, JSON.stringify(newItem), !itemIsPrivate);
      setItems([newItem, ...items]);
      setInput('');
      setIsPrivate(false);
    } catch (err) {
      console.error('Add error:', err);
    }
  };

  const saveNote = async (id) => {
    const updated = items.map(item => 
      item.id === id ? { ...item, text: noteContent, noteContent: noteContent } : item
    );
    setItems(updated);
    
    const item = updated.find(i => i.id === id);
    try {
      await window.storage.set(`item:${id}`, JSON.stringify(item), !item.isPrivate);
      setEditingNote(null);
      setNoteContent('');
    } catch (err) {
      console.error('Save note error:', err);
    }
  };

  const setReminder = async () => {
    if (!reminderDate || !reminderTime) return;
    
    const reminderTimestamp = new Date(`${reminderDate}T${reminderTime}`);
    const updated = items.map(item => 
      item.id === currentItemId 
        ? { ...item, reminderTime: reminderTimestamp.toISOString(), notified: false }
        : item
    );
    setItems(updated);
    
    const item = updated.find(i => i.id === currentItemId);
    try {
      await window.storage.set(`item:${currentItemId}`, JSON.stringify(item), !item.isPrivate);
      setShowReminderModal(false);
      setReminderDate('');
      setReminderTime('');
      setCurrentItemId(null);
    } catch (err) {
      console.error('Reminder error:', err);
    }
  };

  const updatePriority = async (id, newPriority) => {
    const updated = items.map(item => 
      item.id === id ? { ...item, priority: newPriority } : item
    );
    setItems(updated);
    
    const item = updated.find(i => i.id === id);
    try {
      await window.storage.set(`item:${id}`, JSON.stringify(item), !item.isPrivate);
    } catch (err) {
      console.error('Priority update error:', err);
    }
  };

  const toggleComplete = async (id) => {
    const updated = items.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setItems(updated);
    
    const item = updated.find(i => i.id === id);
    try {
      await window.storage.set(`item:${id}`, JSON.stringify(item), !item.isPrivate);
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  const deleteItem = async (id) => {
    const item = items.find(i => i.id === id);
    setItems(items.filter(item => item.id !== id));
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
          <h2 className="text-2xl font-light text-center mb-2 text-gray-800">Welcome</h2>
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
    </div>
  );
}
