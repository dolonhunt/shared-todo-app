// Storage API implementation using localStorage
// Provides get, set, delete, and list methods compatible with the App

const SHARED_PREFIX = 'shared:';
const PRIVATE_PREFIX = 'private:';

const getPrefix = (isShared) => isShared ? SHARED_PREFIX : PRIVATE_PREFIX;

window.storage = {
  async get(key, isShared = true) {
    try {
      const prefix = getPrefix(isShared);
      const value = localStorage.getItem(prefix + key);
      return { value };
    } catch (error) {
      console.error('Storage get error:', error);
      return { value: null };
    }
  },

  async set(key, value, isShared = true) {
    try {
      const prefix = getPrefix(isShared);
      localStorage.setItem(prefix + key, value);
      return { success: true };
    } catch (error) {
      console.error('Storage set error:', error);
      return { success: false };
    }
  },

  async delete(key, isShared = true) {
    try {
      const prefix = getPrefix(isShared);
      localStorage.removeItem(prefix + key);
      return { success: true };
    } catch (error) {
      console.error('Storage delete error:', error);
      return { success: false };
    }
  },

  async list(prefix, isShared = true) {
    try {
      const storagePrefix = getPrefix(isShared);
      const keys = [];

      for (let i = 0; i < localStorage.length; i++) {
        const fullKey = localStorage.key(i);
        if (fullKey && fullKey.startsWith(storagePrefix + prefix)) {
          // Return the key without the storage prefix
          keys.push(fullKey.substring(storagePrefix.length));
        }
      }

      return { keys };
    } catch (error) {
      console.error('Storage list error:', error);
      return { keys: [] };
    }
  }
};
