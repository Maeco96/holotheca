// Optional log of every reading, used to improve the scanner: the photo that was read, the text
// lines found, the candidates proposed and the card the owner picked. Kept on the device in
// IndexedDB; it leaves the phone only when the owner exports the file and hands it over.
const ScanLog = (() => {
  "use strict";

  // Storage names keep the old working name so existing scan logs survive the rename.
  const DB_NAME = "scrinium-scanlog";
  const STORE = "readings";
  const FLAG = "scrinium.scanlog.enabled";
  const MAX_ENTRIES = 150; // oldest readings are dropped beyond this
  let dbPromise = null;
  let lastError = null;

  // BETA: the log is on unless the owner switched it off. Set back to false when the beta ends
  // (see docs/DECISIONS.md, "Open").
  const ON_BY_DEFAULT = true;

  function enabled() {
    try {
      const flag = localStorage.getItem(FLAG);
      return flag === null ? ON_BY_DEFAULT : flag === "1";
    } catch (e) { return false; }
  }

  function setEnabled(on) {
    localStorage.setItem(FLAG, on ? "1" : "0");
  }

  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }).catch((e) => { dbPromise = null; throw e; });
    }
    return dbPromise;
  }

  async function run(mode, work) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // The photo is stored as a data URL string, not a Blob: Safari in private browsing refuses
  // to store Blobs in IndexedDB, which left the 0.8.0 log empty without any message.
  function toJpeg(canvas) {
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  function toDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  /** Stores one reading. Resolves to its id, or null when the log is off or storage fails. */
  async function record(canvas, entry) {
    if (!enabled()) return null;
    try {
      const photo = toJpeg(canvas);
      const id = await run("readwrite", (store) => store.add({ ...entry, at: new Date().toISOString(), chosen: null, photo }));
      const keys = await run("readonly", (store) => store.getAllKeys());
      if (keys.length > MAX_ENTRIES) {
        const extra = keys.slice(0, keys.length - MAX_ENTRIES);
        await run("readwrite", (store) => { extra.forEach((key) => store.delete(key)); });
      }
      lastError = null;
      return id;
    } catch (e) {
      console.warn("scan log not written:", e);
      lastError = (e && (e.message || e.name)) || String(e);
      return null;
    }
  }

  /** Notes what the owner picked for a reading: a card key, or "none" when no candidate was right. */
  async function choose(id, chosen) {
    if (id === null || id === undefined) return;
    try {
      const database = await db();
      await new Promise((resolve, reject) => {
        const tx = database.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const get = store.get(id);
        get.onsuccess = () => { if (get.result) store.put({ ...get.result, chosen }); };
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn("scan log not updated:", e);
    }
  }

  async function count() {
    try { return await run("readonly", (store) => store.count()); } catch (e) { return 0; }
  }

  async function clear() {
    await run("readwrite", (store) => store.clear());
  }

  /** The whole log as one JSON file, photos included as data URLs. */
  async function exportFile(about) {
    const rows = await run("readonly", (store) => store.getAll());
    const readings = [];
    for (const row of rows) {
      const photo = !row.photo ? null : typeof row.photo === "string" ? row.photo : await toDataUrl(row.photo);
      readings.push({ ...row, photo });
    }
    const body = JSON.stringify({ kind: "scrinium-scan-log", exported_at: new Date().toISOString(), ...about, readings });
    const name = `holotheca-letture-${new Date().toISOString().slice(0, 10)}.json`;
    return new File([body], name, { type: "application/json" });
  }

  return { enabled, setEnabled, record, choose, count, clear, exportFile, lastError: () => lastError };
})();
