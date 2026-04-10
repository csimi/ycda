const DB_NAME = "ycda-saves";
const DB_VERSION = 1;
const STORE = "saves";

function promisifyRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("by_savedAt", "savedAt", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
  return dbPromise;
}

export async function listSaves() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const all = await promisifyRequest(tx.objectStore(STORE).getAll());
    return all.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function saveGame(record) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  await promisifyRequest(tx.objectStore(STORE).add(record));
}

export async function deleteSave(id) {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  await promisifyRequest(tx.objectStore(STORE).delete(id));
}
