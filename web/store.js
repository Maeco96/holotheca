// The personal collection, kept on the device in localStorage. Field names follow
// db/collection.sql (owned_copies, binders) so an export can be loaded into that schema later.
// Nothing here is ever sent anywhere; export and import are files the owner handles.
const Store = (() => {
  "use strict";

  // Storage names keep the old working name so existing collections survive the rename.
  const KEY = "scrinium.collection.v1";
  let state = null;

  function blank() {
    return { version: 1, next_id: 1, binders: [], owned_copies: [], sealed_products: [], value_history: [] };
  }

  function read() {
    if (state) return state;
    try {
      state = JSON.parse(localStorage.getItem(KEY)) || blank();
    } catch (e) {
      state = blank();
    }
    // Collections saved before 0.15.0 have no sealed products and no value history.
    state.sealed_products = state.sealed_products || [];
    state.value_history = state.value_history || [];
    return state;
  }

  function write() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function nextId() {
    const id = read().next_id;
    state.next_id = id + 1;
    return id;
  }

  function binders() {
    return read().binders;
  }

  function addBinder(name) {
    const binder = { id: nextId(), name: name.trim(), created_at: new Date().toISOString() };
    state.binders.push(binder);
    write();
    return binder;
  }

  function removeBinder(id) {
    read();
    state.binders = state.binders.filter((b) => b.id !== id);
    for (const copy of state.owned_copies) if (copy.binder_id === id) copy.binder_id = null;
    for (const item of state.sealed_products) if (item.binder_id === id) item.binder_id = null;
    write();
  }

  function copies(binderId) {
    const all = read().owned_copies;
    return binderId === undefined || binderId === null ? all : all.filter((c) => c.binder_id === binderId);
  }

  function copiesOf(cardKey) {
    return read().owned_copies.filter((c) => c.card_source_id === cardKey);
  }

  /** Adds a copy, or raises the quantity of an identical one (same card, variant, language, condition, binder). */
  function addCopy(copy) {
    read();
    const same = state.owned_copies.find((c) =>
      c.card_source_id === copy.card_source_id && c.variant_type === copy.variant_type &&
      (c.variant_subtype || null) === (copy.variant_subtype || null) &&
      (c.variant_stamps || null) === (copy.variant_stamps || null) &&
      (c.variant_foil || null) === (copy.variant_foil || null) &&
      (c.variant_size || null) === (copy.variant_size || null) &&
      c.lang === copy.lang && (c.condition || null) === (copy.condition || null) &&
      (c.binder_id || null) === (copy.binder_id || null) &&
      (c.purchase_price ?? null) === (copy.purchase_price ?? null) &&
      (c.purchase_date || null) === (copy.purchase_date || null) &&
      (c.grade_company || null) === (copy.grade_company || null) && (c.grade || null) === (copy.grade || null));
    if (same) {
      same.quantity += copy.quantity || 1;
      write();
      return same;
    }
    const row = {
      id: nextId(),
      binder_id: copy.binder_id || null,
      card_source_id: copy.card_source_id,
      lang: copy.lang,
      variant_type: copy.variant_type,
      variant_subtype: copy.variant_subtype || null,
      variant_stamps: copy.variant_stamps || null,
      variant_foil: copy.variant_foil || null,
      variant_size: copy.variant_size || null,
      variant_confirmed: copy.variant_confirmed ? 1 : 0,
      condition: copy.condition || null,
      quantity: copy.quantity || 1,
      purchase_price: copy.purchase_price ?? null,
      purchase_currency: copy.purchase_price == null ? null : "EUR",
      purchase_date: copy.purchase_date || null,
      // Graded copy: company and grade on the slab (db/collection.sql official_grades).
      grade_company: copy.grade_company || null,
      grade: copy.grade || null,
      // Value typed by the owner, in euro; wins over the price guide (graded copies need it).
      manual_value: copy.manual_value ?? null,
      notes: copy.notes || null,
      created_at: new Date().toISOString(),
    };
    state.owned_copies.push(row);
    write();
    return row;
  }

  /** Changes the quantity by `delta`; a copy that reaches zero is removed. */
  function changeQuantity(id, delta) {
    read();
    const copy = state.owned_copies.find((c) => c.id === id);
    if (!copy) return;
    copy.quantity += delta;
    if (copy.quantity <= 0) state.owned_copies = state.owned_copies.filter((c) => c.id !== id);
    write();
  }

  /** Sets or clears (null) the value typed by the owner for a copy. */
  function setCopyValue(id, value) {
    read();
    const copy = state.owned_copies.find((c) => c.id === id);
    if (!copy) return;
    copy.manual_value = value;
    write();
  }

  // ---------- sealed products (db/collection.sql sealed_products) ----------

  function sealed(binderId) {
    const all = read().sealed_products;
    return binderId === undefined || binderId === null ? all : all.filter((s) => s.binder_id === binderId);
  }

  function addSealed(item) {
    read();
    const row = {
      id: nextId(),
      binder_id: item.binder_id || null,
      cardmarket_id: item.cardmarket_id || null,
      name: item.name,
      product_type: item.product_type || null,
      lang: item.lang || null,
      quantity: item.quantity || 1,
      purchase_price: item.purchase_price ?? null,
      purchase_currency: item.purchase_price == null ? null : "EUR",
      purchase_date: item.purchase_date || null,
      manual_value: item.manual_value ?? null,
      notes: item.notes || null,
      created_at: new Date().toISOString(),
    };
    state.sealed_products.push(row);
    write();
    return row;
  }

  function changeSealedQuantity(id, delta) {
    read();
    const item = state.sealed_products.find((s) => s.id === id);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) state.sealed_products = state.sealed_products.filter((s) => s.id !== id);
    write();
  }

  function setSealedValue(id, value) {
    read();
    const item = state.sealed_products.find((s) => s.id === id);
    if (!item) return;
    item.manual_value = value;
    write();
  }

  // ---------- value history ----------

  /**
   * Records the value of the whole collection for a price day (one row per day, replaced when
   * the same day is recorded again): { day, value, spent, priced, unpriced }.
   */
  function recordValue(row) {
    read();
    const list = state.value_history;
    const at = list.findIndex((r) => r.day === row.day);
    if (at >= 0) {
      const old = list[at];
      if (old.value === row.value && old.spent === row.spent && old.unpriced === row.unpriced) return;
      list[at] = row;
    } else {
      list.push(row);
      list.sort((a, b) => (a.day < b.day ? -1 : 1));
    }
    write();
  }

  function valueHistory() {
    return read().value_history;
  }

  function stats(binderId) {
    const list = copies(binderId);
    let total = 0;
    let spent = 0;
    const distinct = new Set();
    for (const copy of list) {
      total += copy.quantity;
      distinct.add(copy.card_source_id);
      if (copy.purchase_price != null) spent += copy.purchase_price * copy.quantity;
    }
    for (const item of sealed(binderId)) {
      if (item.purchase_price != null) spent += item.purchase_price * item.quantity;
    }
    return { total, distinct: distinct.size, spent };
  }

  function exportJson() {
    return JSON.stringify({ ...read(), exported_at: new Date().toISOString() }, null, 2);
  }

  /** Replaces the collection with an exported file. Throws when the file is not a Holotheca export. */
  function importJson(text) {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.owned_copies) || !Array.isArray(data.binders)) {
      throw new Error("Il file non è un'esportazione di Holotheca.");
    }
    state = {
      version: 1, next_id: data.next_id || 1, binders: data.binders, owned_copies: data.owned_copies,
      sealed_products: data.sealed_products || [], value_history: data.value_history || [],
    };
    const highest = Math.max(0, ...state.binders.map((b) => b.id), ...state.owned_copies.map((c) => c.id),
      ...state.sealed_products.map((s) => s.id));
    if (state.next_id <= highest) state.next_id = highest + 1;
    write();
    return stats();
  }

  return {
    binders, addBinder, removeBinder, copies, copiesOf, addCopy, changeQuantity, setCopyValue,
    sealed, addSealed, changeSealedQuantity, setSealedValue, recordValue, valueHistory,
    stats, exportJson, importJson,
  };
})();
