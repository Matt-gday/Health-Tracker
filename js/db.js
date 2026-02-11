/* ============================================
   Heart & Health Tracker — Database Layer
   IndexedDB operations for all data stores
   ============================================ */

const DB = {
  name: 'heartTracker',
  version: 1,
  db: null,

  /* ---------- Initialization ---------- */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        // Events store — all health events
        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('eventType', 'eventType', { unique: false });
          eventStore.createIndex('timestamp', 'timestamp', { unique: false });
          eventStore.createIndex('type_time', ['eventType', 'timestamp'], { unique: false });
        }

        // Active toggles (AFib, Sleep, Walk currently running)
        if (!db.objectStoreNames.contains('activeToggles')) {
          db.createObjectStore('activeToggles', { keyPath: 'type' });
        }

        // Food library
        if (!db.objectStoreNames.contains('foodLibrary')) {
          const foodStore = db.createObjectStore('foodLibrary', { keyPath: 'id' });
          foodStore.createIndex('name', 'name', { unique: false });
        }

        // Drink library
        if (!db.objectStoreNames.contains('drinkLibrary')) {
          const drinkStore = db.createObjectStore('drinkLibrary', { keyPath: 'id' });
          drinkStore.createIndex('name', 'name', { unique: false });
        }

        // Medications master list
        if (!db.objectStoreNames.contains('medications')) {
          const medStore = db.createObjectStore('medications', { keyPath: 'id' });
          medStore.createIndex('schedule', 'schedule', { unique: false });
        }

        // Settings key-value store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  },

  /* ---------- Helpers ---------- */
  _generateId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  },

  _getStore(storeName, mode = 'readonly') {
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  },

  _promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /* ---------- Events CRUD ---------- */
  async addEvent(event) {
    const record = {
      id: this._generateId(),
      timestamp: new Date().toISOString(),
      lastEdited: null,
      isDuringAFib: false,
      notes: '',
      ...event
    };
    // Auto-detect AFib state
    const afibToggle = await this.getActiveToggle('afib');
    if (afibToggle && record.eventType !== 'afib') {
      record.isDuringAFib = true;
    }
    const store = this._getStore('events', 'readwrite');
    await this._promisify(store.add(record));
    return record;
  },

  async getEvent(id) {
    const store = this._getStore('events');
    return this._promisify(store.get(id));
  },

  async updateEvent(id, updates) {
    const store = this._getStore('events', 'readwrite');
    const record = await this._promisify(store.get(id));
    if (!record) throw new Error('Event not found');
    Object.assign(record, updates, { lastEdited: new Date().toISOString() });
    await this._promisify(store.put(record));
    return record;
  },

  async deleteEvent(id) {
    const store = this._getStore('events', 'readwrite');
    return this._promisify(store.delete(id));
  },

  async getAllEvents(eventType = null, limit = 100) {
    return new Promise((resolve, reject) => {
      const store = this._getStore('events');
      const results = [];
      let cursorRequest;

      if (eventType) {
        const index = store.index('type_time');
        const range = IDBKeyRange.bound(
          [eventType, ''],
          [eventType, '\uffff']
        );
        cursorRequest = index.openCursor(range, 'prev');
      } else {
        const index = store.index('timestamp');
        cursorRequest = index.openCursor(null, 'prev');
      }

      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  },

  async getEventsInRange(startDate, endDate, eventType = null) {
    return new Promise((resolve, reject) => {
      const store = this._getStore('events');
      const index = store.index('timestamp');
      const range = IDBKeyRange.bound(startDate, endDate);
      const results = [];

      const cursorRequest = index.openCursor(range, 'prev');
      cursorRequest.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          if (!eventType || cursor.value.eventType === eventType) {
            results.push(cursor.value);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  },

  async getEventsByTypes(types, limit = 200) {
    const allEvents = await this.getAllEvents(null, 1000);
    return allEvents
      .filter(e => types.includes(e.eventType))
      .slice(0, limit);
  },

  /* ---------- Active Toggles ---------- */
  async getActiveToggle(type) {
    const store = this._getStore('activeToggles');
    return this._promisify(store.get(type));
  },

  async setActiveToggle(type, data) {
    const store = this._getStore('activeToggles', 'readwrite');
    await this._promisify(store.put({ type, ...data }));
  },

  async clearActiveToggle(type) {
    const store = this._getStore('activeToggles', 'readwrite');
    return this._promisify(store.delete(type));
  },

  async getAllActiveToggles() {
    const store = this._getStore('activeToggles');
    return this._promisify(store.getAll());
  },

  /* ---------- Food Library ---------- */
  async addFoodItem(item) {
    const record = { id: this._generateId(), ...item };
    const store = this._getStore('foodLibrary', 'readwrite');
    await this._promisify(store.add(record));
    return record;
  },

  async getFoodItem(id) {
    const store = this._getStore('foodLibrary');
    return this._promisify(store.get(id));
  },

  async getAllFoodItems() {
    const store = this._getStore('foodLibrary');
    return this._promisify(store.getAll());
  },

  async searchFoodLibrary(query) {
    const all = await this.getAllFoodItems();
    const q = query.toLowerCase();
    return all.filter(item => item.name.toLowerCase().includes(q));
  },

  async updateFoodItem(id, updates) {
    const store = this._getStore('foodLibrary', 'readwrite');
    const record = await this._promisify(store.get(id));
    if (!record) throw new Error('Food item not found');
    Object.assign(record, updates);
    await this._promisify(store.put(record));
    return record;
  },

  async deleteFoodItem(id) {
    const store = this._getStore('foodLibrary', 'readwrite');
    return this._promisify(store.delete(id));
  },

  /* ---------- Drink Library ---------- */
  async addDrinkItem(item) {
    const record = { id: this._generateId(), ...item };
    const store = this._getStore('drinkLibrary', 'readwrite');
    await this._promisify(store.add(record));
    return record;
  },

  async getDrinkItem(id) {
    const store = this._getStore('drinkLibrary');
    return this._promisify(store.get(id));
  },

  async getAllDrinkItems() {
    const store = this._getStore('drinkLibrary');
    return this._promisify(store.getAll());
  },

  async searchDrinkLibrary(query) {
    const all = await this.getAllDrinkItems();
    const q = query.toLowerCase();
    return all.filter(item => item.name.toLowerCase().includes(q));
  },

  async updateDrinkItem(id, updates) {
    const store = this._getStore('drinkLibrary', 'readwrite');
    const record = await this._promisify(store.get(id));
    if (!record) throw new Error('Drink item not found');
    Object.assign(record, updates);
    await this._promisify(store.put(record));
    return record;
  },

  async deleteDrinkItem(id) {
    const store = this._getStore('drinkLibrary', 'readwrite');
    return this._promisify(store.delete(id));
  },

  /* ---------- Medications ---------- */
  async getMedications() {
    const store = this._getStore('medications');
    return this._promisify(store.getAll());
  },

  async getMedication(id) {
    const store = this._getStore('medications');
    return this._promisify(store.get(id));
  },

  async addMedication(med) {
    const record = { id: this._generateId(), ...med };
    const store = this._getStore('medications', 'readwrite');
    await this._promisify(store.add(record));
    return record;
  },

  async updateMedication(id, updates) {
    const store = this._getStore('medications', 'readwrite');
    const record = await this._promisify(store.get(id));
    if (!record) throw new Error('Medication not found');
    Object.assign(record, updates);
    await this._promisify(store.put(record));
    return record;
  },

  async deleteMedication(id) {
    const store = this._getStore('medications', 'readwrite');
    return this._promisify(store.delete(id));
  },

  async getMedicationsBySchedule(schedule) {
    const all = await this.getMedications();
    return all.filter(m => m.schedule === schedule || m.schedule === 'Both');
  },

  /* ---------- Settings ---------- */
  async getSetting(key) {
    const store = this._getStore('settings');
    const result = await this._promisify(store.get(key));
    return result ? result.value : null;
  },

  async setSetting(key, value) {
    const store = this._getStore('settings', 'readwrite');
    await this._promisify(store.put({ key, value }));
  },

  /* ---------- Query Helpers ---------- */
  _localDateStr(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  _localDayRange(dateStr) {
    // Create local midnight boundaries and convert to ISO for comparison
    const parts = dateStr.split('-');
    const start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0);
    const end = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999);
    return [start.toISOString(), end.toISOString()];
  },

  async getDailyDrinkTotal(dateStr) {
    const [start, end] = this._localDayRange(dateStr);
    const events = await this.getEventsInRange(start, end, 'drink');
    return events.reduce((sum, e) => sum + (e.volume_ml || 0), 0);
  },

  async getDailyFoodTotals(dateStr) {
    const [start, end] = this._localDayRange(dateStr);
    const events = await this.getEventsInRange(start, end, 'food');
    return {
      calories: events.reduce((s, e) => s + (e.calories || 0), 0),
      protein_g: events.reduce((s, e) => s + (e.protein_g || 0), 0),
      carbs_g: events.reduce((s, e) => s + (e.carbs_g || 0), 0),
      fat_g: events.reduce((s, e) => s + (e.fat_g || 0), 0),
      sodium_mg: events.reduce((s, e) => s + (e.sodium_mg || 0), 0),
      count: events.length
    };
  },

  async getTodayMedStatus(timeOfDay) {
    const today = this._localDateStr();
    const [start, end] = this._localDayRange(today);
    const events = await this.getEventsInRange(start, end);
    return events.filter(e =>
      (e.eventType === 'medication') && e.timeOfDay === timeOfDay
    );
  },

  async getYesterdayMedStatus(timeOfDay) {
    const yd = new Date();
    yd.setDate(yd.getDate() - 1);
    const yesterday = this._localDateStr(yd);
    const [start, end] = this._localDayRange(yesterday);
    const events = await this.getEventsInRange(start, end);
    return events.filter(e =>
      (e.eventType === 'medication') && e.timeOfDay === timeOfDay
    );
  },

  async getDailySummary(dateStr) {
    const [start, end] = this._localDayRange(dateStr);
    const allEvents = await this.getEventsInRange(start, end);
    return this._buildSummaryFromEvents(allEvents);
  },

  _buildSummaryFromEvents(events) {
    const afibEvents = events.filter(e => e.eventType === 'afib');
    const bpEvents = events.filter(e => e.eventType === 'bp_hr');
    const sleepEvents = events.filter(e => e.eventType === 'sleep');
    const weightEvents = events.filter(e => e.eventType === 'weight');
    const walkEvents = events.filter(e => e.eventType === 'walk');
    const stepsEvents = events.filter(e => e.eventType === 'steps');
    const foodEvents = events.filter(e => e.eventType === 'food');
    const drinkEvents = events.filter(e => e.eventType === 'drink');
    const medEvents = events.filter(e => e.eventType === 'medication');

    // Latest BP reading
    const lastBp = bpEvents.length > 0 ? bpEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] : null;

    // Latest weight
    const lastWeight = weightEvents.length > 0 ? weightEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] : null;

    return {
      afib: {
        count: afibEvents.length,
        active: false,
        activeDuration: 0,
        totalMin: afibEvents.reduce((s, e) => s + (e.duration_min || 0), 0)
      },
      bp: {
        count: bpEvents.length,
        lastSys: lastBp?.systolic || 0,
        lastDia: lastBp?.diastolic || 0,
        lastHr: lastBp?.heartRate || 0
      },
      sleep: {
        totalMin: sleepEvents.reduce((s, e) => s + (e.duration_min || 0), 0),
        count: sleepEvents.length
      },
      weight: {
        latest: lastWeight?.weight_kg || null
      },
      walk: {
        totalMin: walkEvents.reduce((s, e) => s + (e.duration_min || 0), 0),
        active: false,
        count: walkEvents.length
      },
      steps: {
        total: stepsEvents.reduce((s, e) => s + (e.step_count || 0), 0)
      },
      food: {
        count: foodEvents.length,
        calories: foodEvents.reduce((s, e) => s + (e.calories || 0), 0),
        protein: foodEvents.reduce((s, e) => s + (e.protein_g || 0), 0),
        carbs: foodEvents.reduce((s, e) => s + (e.carbs_g || 0), 0),
        fat: foodEvents.reduce((s, e) => s + (e.fat_g || 0), 0),
        sodium: foodEvents.reduce((s, e) => s + (e.sodium_mg || 0), 0)
      },
      drink: {
        totalMl: drinkEvents.reduce((s, e) => s + (e.volume_ml || 0), 0),
        calories: drinkEvents.reduce((s, e) => s + (e.calories || 0), 0),
        caffeine: drinkEvents.reduce((s, e) => s + (e.caffeine_mg || 0), 0),
        count: drinkEvents.length
      },
      meds: {
        takenCount: medEvents.length,
        totalCount: 0 // Will be filled in by caller with actual med count
      }
    };
  },

  /* ---------- Seed Default Data ---------- */
  async seedDefaults() {
    // Check if already seeded
    const seeded = await this.getSetting('seeded');
    if (seeded) return;

    // Pre-load medications
    const defaultMeds = [
      { name: 'Sotalol Hydrochloride 80mg', dosage: 'Half tablet (40mg)', schedule: 'Both' },
      { name: 'Telmisartan/Hydrochlorothiazide 80mg/25mg', dosage: '1 tablet', schedule: 'Morning' },
      { name: 'Rilast Turbuhaler (Budesonide/Formoterol)', dosage: '1 inhalation', schedule: 'Both' },
      { name: 'Super Multi Plus (Ethical Nutrients)', dosage: '1 tablet', schedule: 'Morning' }
    ];

    for (const med of defaultMeds) {
      await this.addMedication(med);
    }

    // Pre-load user info
    await this.setSetting('userName', 'Matt Allan');
    await this.setSetting('userDOB', '1973-06-16');
    await this.setSetting('userHeight', 190);
    await this.setSetting('userStartingWeight', 160);
    await this.setSetting('checkUpdates', true);

    await this.setSetting('seeded', true);
  },

  /* ---------- Full Export / Import ---------- */
  async exportAll() {
    const data = {
      exportDate: new Date().toISOString(),
      version: '1.0.0',
      events: await this._promisify(this._getStore('events').getAll()),
      foodLibrary: await this._promisify(this._getStore('foodLibrary').getAll()),
      drinkLibrary: await this._promisify(this._getStore('drinkLibrary').getAll()),
      medications: await this._promisify(this._getStore('medications').getAll()),
      settings: await this._promisify(this._getStore('settings').getAll()),
      activeToggles: await this._promisify(this._getStore('activeToggles').getAll())
    };
    return data;
  },

  async importAll(data) {
    // Clear all stores then import
    const storeNames = ['events', 'foodLibrary', 'drinkLibrary', 'medications', 'settings', 'activeToggles'];

    for (const storeName of storeNames) {
      const store = this._getStore(storeName, 'readwrite');
      await this._promisify(store.clear());
    }

    // Import each store
    if (data.events) {
      for (const record of data.events) {
        const store = this._getStore('events', 'readwrite');
        await this._promisify(store.add(record));
      }
    }
    if (data.foodLibrary) {
      for (const record of data.foodLibrary) {
        const store = this._getStore('foodLibrary', 'readwrite');
        await this._promisify(store.add(record));
      }
    }
    if (data.drinkLibrary) {
      for (const record of data.drinkLibrary) {
        const store = this._getStore('drinkLibrary', 'readwrite');
        await this._promisify(store.add(record));
      }
    }
    if (data.medications) {
      for (const record of data.medications) {
        const store = this._getStore('medications', 'readwrite');
        await this._promisify(store.add(record));
      }
    }
    if (data.settings) {
      for (const record of data.settings) {
        const store = this._getStore('settings', 'readwrite');
        await this._promisify(store.add(record));
      }
    }
    if (data.activeToggles) {
      for (const record of data.activeToggles) {
        const store = this._getStore('activeToggles', 'readwrite');
        await this._promisify(store.add(record));
      }
    }
  }
};
