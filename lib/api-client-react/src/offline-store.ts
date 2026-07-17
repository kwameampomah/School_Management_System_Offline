const DB_NAME = "taifa-offline-db";
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

export interface QueueItem {
  id?: number;
  url: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
  timestamp: number;
}

export function initDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Failed to open offline database.");
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      // Store 1: GET requests cache
      if (!db.objectStoreNames.contains("caches")) {
        db.createObjectStore("caches", { keyPath: "url" });
      }

      // Store 2: Mutation sync queue
      if (!db.objectStoreNames.contains("syncQueue")) {
        db.createObjectStore("syncQueue", { keyPath: "id", autoIncrement: true });
      }
    };
  });
}

// ----------------------------------------------------
// CACHE (GET Queries) Operations
// ----------------------------------------------------

export async function cacheSet(url: string, response: any): Promise<void> {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("caches", "readwrite");
    const store = transaction.objectStore("caches");
    
    const item = {
      url,
      response,
      timestamp: Date.now()
    };

    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function cacheGet(url: string): Promise<any | null> {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("caches", "readonly");
    const store = transaction.objectStore("caches");
    
    const request = store.get(url);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result ? result.response : null);
    };
    request.onerror = () => reject(request.error);
  });
}

// ----------------------------------------------------
// SYNC QUEUE (POST/PUT/PATCH/DELETE Mutations) Operations
// ----------------------------------------------------

export async function queueAdd(
  url: string,
  method: string,
  body: any,
  headers: Record<string, string>
): Promise<number> {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("syncQueue", "readwrite");
    const store = transaction.objectStore("syncQueue");

    const item: QueueItem = {
      url,
      method,
      body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : null,
      headers,
      timestamp: Date.now()
    };

    const request = store.add(item);
    request.onsuccess = () => {
      const insertedId = request.result as number;
      // Dispatch custom event to notify UI sync status component
      window.dispatchEvent(new CustomEvent("offline-sync-queue-updated"));
      resolve(insertedId);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function queueGet(): Promise<QueueItem[]> {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("syncQueue", "readonly");
    const store = transaction.objectStore("syncQueue");
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by ID to preserve FIFO order (First-In, First-Out)
      const items = (request.result as QueueItem[]).sort((a, b) => (a.id || 0) - (b.id || 0));
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function queueRemove(id: number): Promise<void> {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("syncQueue", "readwrite");
    const store = transaction.objectStore("syncQueue");
    const request = store.delete(id);

    request.onsuccess = () => {
      // Dispatch custom event to notify UI sync status component
      window.dispatchEvent(new CustomEvent("offline-sync-queue-updated"));
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function queueCount(): Promise<number> {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("syncQueue", "readonly");
    const store = transaction.objectStore("syncQueue");
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
