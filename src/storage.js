
// LocalStorage-based polyfill for window.storage
window.storage = {
  async set(key, value, isShared = false) {
    const prefix = isShared ? "shared_" : "private_";
    localStorage.setItem(prefix + key, value);
  },
  async get(key, isShared = false) {
    const prefix = isShared ? "shared_" : "private_";
    const value = localStorage.getItem(prefix + key);
    return value ? { value } : null;
  },
  async delete(key, isShared = false) {
    const prefix = isShared ? "shared_" : "private_";
    localStorage.removeItem(prefix + key);
  },
  async list(prefix, isShared = false) {
    const p = isShared ? "shared_" : "private_";
    const keys = Object.keys(localStorage)
      .filter((k) => k.startsWith(p + prefix))
      .map((k) => k.replace(p, ""));
    return { keys };
  }
};
