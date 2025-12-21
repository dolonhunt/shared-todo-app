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
          .filter(r => r?
