/* ============================================
   Heart & Health Tracker — Main Application
   Navigation, state, event handling
   ============================================ */

const App = {
  APP_VERSION: '1.5.0',
  currentTab: 'home',
  previousPages: [],
  historyFilters: ['all'],
  dashboardLayers: [],
  dashboardRange: 'week',
  _fullscreenSaveHandler: null,
  _editingEventId: null,

  /* ---------- Initialization ---------- */
  async init() {
    try {
      await DB.init();
      await DB.seedDefaults();
      await this.loadToggleStates();
      await this.renderCurrentTab();
      await this.checkMedicationReminders();
      this.setupToggleGroupListeners();
      this._autoCheckForUpdates();
      console.log('Heart Tracker v' + this.APP_VERSION + ' initialized');
    } catch (err) {
      console.error('Init failed:', err);
      UI.showToast('Failed to initialize app', 'error');
    }
  },

  /* ---------- Toggle States ---------- */
  toggleStates: { afib: null, sleep: null, walk: null },

  async loadToggleStates() {
    const types = ['afib', 'sleep', 'walk'];
    for (const type of types) {
      this.toggleStates[type] = await DB.getActiveToggle(type);
    }
  },

  /* ---------- Tab Navigation ---------- */
  switchTab(tab) {
    this.currentTab = tab;
    this.previousPages = [];

    // Update tab bar
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Always show tab bar on main tabs
    document.getElementById('tab-bar').style.display = 'flex';

    // Show correct page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageId = tab === 'home' ? 'page-home' :
                   tab === 'dashboard' ? 'page-dashboard' :
                   tab === 'history' ? 'page-history' :
                   tab === 'settings' ? 'page-settings' : 'page-home';
    document.getElementById(pageId).classList.add('active');

    this.renderCurrentTab();
  },

  async renderCurrentTab() {
    switch (this.currentTab) {
      case 'home':
        const dailySummary = await this._getDailySummary();
        UI.renderHome(this.toggleStates, dailySummary);
        break;
      case 'dashboard':
        UI.renderDashboard();
        Charts.renderDashboard(this.dashboardLayers, this.dashboardRange);
        break;
      case 'history':
        await this.refreshHistory();
        break;
      case 'settings':
        UI.renderSettings();
        break;
    }
  },

  async _getDailySummary() {
    const today = UI.todayStr();
    const summary = await DataSource.getDailySummary(today);

    // Enrich with active toggle states
    if (this.toggleStates.afib) {
      summary.afib.active = true;
      const startMs = new Date(this.toggleStates.afib.startTime).getTime();
      summary.afib.activeDuration = Math.round((Date.now() - startMs) / 60000);
    }
    if (this.toggleStates.sleep) {
      summary.sleep.active = true;
      const sleepStartMs = new Date(this.toggleStates.sleep.startTime).getTime();
      summary.sleep.activeMin = Math.round((Date.now() - sleepStartMs) / 60000);
    }
    if (this.toggleStates.walk) {
      summary.walk.active = true;
      const walkStartMs = new Date(this.toggleStates.walk.startTime).getTime();
      summary.walk.activeMin = Math.round((Date.now() - walkStartMs) / 60000);
    }

    // Enrich med count with how many are expected today
    try {
      const allMeds = await DB.getMedications();
      // Each med could be AM, PM, or Both — count expected doses
      let totalDoses = 0;
      for (const med of allMeds) {
        if (med.schedule === 'Both') totalDoses += 2;
        else totalDoses += 1;
      }
      summary.meds.totalCount = totalDoses;
    } catch (e) { /* ignore */ }

    return summary;
  },

  /* ---------- Detail Pages ---------- */
  async openDetail(type) {
    this.previousPages.push(this.currentTab);
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-detail').classList.add('active');
    document.getElementById('tab-bar').style.display = 'none';

    let events, stats;
    switch (type) {
      case 'afib':
        events = await DataSource.getAllEvents('afib', 100);
        stats = this._calcAfibStats(events);
        break;
      case 'bp_hr':
        events = await DataSource.getAllEvents('bp_hr', 100);
        stats = this._calcBpStats(events);
        break;
      case 'sleep':
        events = await DataSource.getAllEvents('sleep', 100);
        stats = this._calcSleepStats(events);
        break;
      case 'weight':
        events = await DataSource.getAllEvents('weight', 100);
        stats = this._calcWeightStats(events);
        break;
      case 'activity':
        const walks = await DataSource.getAllEvents('walk', 100);
        const steps = await DataSource.getAllEvents('steps', 100);
        events = [...walks, ...steps].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        stats = this._calcActivityStats(walks, steps);
        break;
      case 'food':
        events = await DataSource.getAllEvents('food', 100);
        stats = await this._calcFoodStats();
        break;
      case 'drink':
        events = await DataSource.getAllEvents('drink', 100);
        stats = await this._calcDrinkStats();
        break;
      case 'medication':
        const meds = await DataSource.getAllEvents('medication', 100);
        const vent = await DataSource.getAllEvents('ventolin', 100);
        events = [...meds, ...vent].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        stats = this._calcMedStats(meds);
        break;
      default:
        events = [];
        stats = [];
    }

    UI.renderDetailPage(type, stats, events);
    Charts.renderDetail(type, events);
  },

  goBack() {
    document.getElementById('tab-bar').style.display = 'flex';
    const prev = this.previousPages.pop() || 'home';
    this.switchTab(prev);
  },

  /* ---------- Home Action Handlers ---------- */
  async handleAction(action) {
    switch (action) {
      case 'afib': await this.toggleAfib(); break;
      case 'bp': this.openBpEntry(); break;
      case 'sleep': await this.toggleSleep(); break;
      case 'weight': this.openWeightEntry(); break;
      case 'walk': await this.toggleWalk(); break;
      case 'steps': this.openStepsEntry(); break;
      case 'food': this.openFoodEntry(); break;
      case 'drink': this.openDrinkEntry(); break;
      case 'medication': await this.openMedicationChecklist(); break;
    }
  },

  /* ---------- Toggle Actions ---------- */
  async toggleAfib() {
    if (this.toggleStates.afib) {
      // Stop AFib
      const toggle = this.toggleStates.afib;
      const startTime = new Date(toggle.startTime);
      const endTime = new Date();
      const duration_min = Math.round((endTime - startTime) / 60000);

      await DB.addEvent({
        eventType: 'afib',
        startTime: toggle.startTime,
        endTime: endTime.toISOString(),
        timestamp: toggle.startTime,
        duration_min,
        isDuringAFib: true
      });

      await DB.clearActiveToggle('afib');
      this.toggleStates.afib = null;
      UI.showToast(`AFib episode ended — ${UI.formatDuration(duration_min)}`, 'info');
    } else {
      // Start AFib
      const startTime = new Date().toISOString();
      await DB.setActiveToggle('afib', { startTime });
      this.toggleStates.afib = { type: 'afib', startTime };
      UI.showToast('AFib episode started', 'warning');
    }
    const summary1 = await this._getDailySummary();
    UI.renderHome(this.toggleStates, summary1);
  },

  async toggleSleep() {
    if (this.toggleStates.sleep) {
      const toggle = this.toggleStates.sleep;
      const startTime = new Date(toggle.startTime);
      const endTime = new Date();
      const duration_min = Math.round((endTime - startTime) / 60000);

      await DB.addEvent({
        eventType: 'sleep',
        startTime: toggle.startTime,
        endTime: endTime.toISOString(),
        timestamp: toggle.startTime,
        duration_min
      });

      await DB.clearActiveToggle('sleep');
      this.toggleStates.sleep = null;
      UI.showToast(`Sleep logged — ${UI.formatDuration(duration_min)}`, 'success');
    } else {
      const startTime = new Date().toISOString();
      await DB.setActiveToggle('sleep', { startTime });
      this.toggleStates.sleep = { type: 'sleep', startTime };
      UI.showToast('Sleep tracking started', 'info');
    }
    const summary2 = await this._getDailySummary();
    UI.renderHome(this.toggleStates, summary2);
  },

  async toggleWalk() {
    if (this.toggleStates.walk) {
      const toggle = this.toggleStates.walk;
      const startTime = new Date(toggle.startTime);
      const endTime = new Date();
      const duration_min = Math.round((endTime - startTime) / 60000);

      await DB.addEvent({
        eventType: 'walk',
        startTime: toggle.startTime,
        endTime: endTime.toISOString(),
        timestamp: toggle.startTime,
        duration_min
      });

      await DB.clearActiveToggle('walk');
      this.toggleStates.walk = null;
      UI.showToast(`Walk logged — ${UI.formatDuration(duration_min)}`, 'success');
    } else {
      const startTime = new Date().toISOString();
      await DB.setActiveToggle('walk', { startTime });
      this.toggleStates.walk = { type: 'walk', startTime };
      UI.showToast('Walk tracking started', 'info');
    }
    const summary3 = await this._getDailySummary();
    UI.renderHome(this.toggleStates, summary3);
  },

  /* ---------- Entry Forms ---------- */
  openBpEntry(existingData = null) {
    this._editingEventId = existingData?.id || null;
    const title = existingData ? 'Edit BP / HR' : 'Log BP / HR';
    const body = UI.buildBpEntryForm(existingData);
    const footer = `
      ${existingData ? '<button class="btn btn-danger btn-sm" style="margin-bottom:8px" onclick="App.deleteCurrentEntry()">Delete Entry</button>' : ''}
      <button class="btn btn-primary" onclick="App.saveBpEntry()">Save</button>`;
    UI.openModal(title, body, footer);
    this.setupToggleGroupListeners();
  },

  async saveBpEntry() {
    const data = {
      eventType: 'bp_hr',
      systolic: parseInt(document.getElementById('bp-systolic').value) || null,
      diastolic: parseInt(document.getElementById('bp-diastolic').value) || null,
      heartRate: parseInt(document.getElementById('bp-hr').value) || null,
      exerciseContext: this._getToggleValue('bp-exercise-ctx'),
      foodContext: this._getToggleValue('bp-food-ctx'),
      timestamp: new Date(document.getElementById('bp-timestamp').value).toISOString(),
      notes: document.getElementById('bp-notes').value.trim()
    };

    if (!data.systolic && !data.diastolic && !data.heartRate) {
      UI.showToast('Please enter at least one value', 'error');
      return;
    }

    if (this._editingEventId) {
      await DB.updateEvent(this._editingEventId, data);
      UI.showToast('BP/HR reading updated', 'success');
    } else {
      await DB.addEvent(data);
      UI.showToast('BP/HR reading saved', 'success');
    }
    UI.closeModal();
    this._editingEventId = null;
    await this.renderCurrentTab();
  },

  openWeightEntry(existingData = null) {
    this._editingEventId = existingData?.id || null;
    const title = existingData ? 'Edit Weight' : 'Log Weight';
    const body = UI.buildWeightEntryForm(existingData);
    const footer = `
      ${existingData ? '<button class="btn btn-danger btn-sm" style="margin-bottom:8px" onclick="App.deleteCurrentEntry()">Delete Entry</button>' : ''}
      <button class="btn btn-primary" onclick="App.saveWeightEntry()">Save</button>`;
    UI.openModal(title, body, footer);
  },

  async saveWeightEntry() {
    const weight = parseFloat(document.getElementById('weight-value').value);
    if (!weight) {
      UI.showToast('Please enter a weight', 'error');
      return;
    }
    const data = {
      eventType: 'weight',
      weight_kg: weight,
      timestamp: new Date(document.getElementById('weight-timestamp').value).toISOString(),
      notes: document.getElementById('weight-notes').value.trim()
    };

    if (this._editingEventId) {
      await DB.updateEvent(this._editingEventId, data);
      UI.showToast('Weight updated', 'success');
    } else {
      await DB.addEvent(data);
      UI.showToast(`Weight logged: ${weight} kg`, 'success');
    }
    UI.closeModal();
    this._editingEventId = null;
    await this.renderCurrentTab();
  },

  openStepsEntry(existingData = null) {
    this._editingEventId = existingData?.id || null;
    const title = existingData ? 'Edit Steps' : 'Log Steps';
    const body = UI.buildStepsEntryForm(existingData);
    const footer = `
      ${existingData ? '<button class="btn btn-danger btn-sm" style="margin-bottom:8px" onclick="App.deleteCurrentEntry()">Delete Entry</button>' : ''}
      <button class="btn btn-primary" onclick="App.saveStepsEntry()">Save</button>`;
    UI.openModal(title, body, footer);
  },

  async saveStepsEntry() {
    const steps = parseInt(document.getElementById('steps-value').value);
    if (!steps) {
      UI.showToast('Please enter step count', 'error');
      return;
    }
    const dateVal = document.getElementById('steps-date').value;
    const data = {
      eventType: 'steps',
      steps,
      date: dateVal,
      timestamp: new Date(dateVal + 'T12:00:00').toISOString(),
      notes: document.getElementById('steps-notes').value.trim()
    };

    if (this._editingEventId) {
      await DB.updateEvent(this._editingEventId, data);
      UI.showToast('Steps updated', 'success');
    } else {
      await DB.addEvent(data);
      UI.showToast(`${steps.toLocaleString()} steps logged`, 'success');
    }
    UI.closeModal();
    this._editingEventId = null;
    await this.renderCurrentTab();
  },

  /* ---------- Food Entry ---------- */
  openFoodEntry(existingData = null) {
    this._editingEventId = existingData?.id || null;
    const title = existingData ? 'Edit Food' : 'Log Food';
    const body = UI.buildFoodEntryForm(existingData);
    const footer = `
      ${existingData ? '<button class="btn btn-danger btn-sm" style="margin-bottom:8px" onclick="App.deleteCurrentEntry()">Delete Entry</button>' : ''}
      <button class="btn btn-primary" onclick="App.saveFoodEntry()">Save</button>`;
    UI.openModal(title, body, footer);

    // Setup autocomplete
    setTimeout(() => {
      const searchInput = document.getElementById('food-search');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => this._foodAutocomplete(e.target.value));
        searchInput.addEventListener('focus', (e) => this._foodAutocomplete(e.target.value));
      }
    }, 100);
  },

  async _foodAutocomplete(query) {
    const list = document.getElementById('food-autocomplete');
    if (!query || query.length < 2) {
      list.classList.remove('visible');
      return;
    }
    const results = await DB.searchFoodLibrary(query);
    if (results.length === 0) {
      list.classList.remove('visible');
      return;
    }
    list.innerHTML = results.map(item => `
      <div class="autocomplete-item" onclick="App.selectFoodLibraryItem('${item.id}')">
        <div class="item-name">${item.name}</div>
        <div class="item-detail">${item.calories ? item.calories + ' kcal · ' : ''}P:${item.protein_g || 0}g C:${item.carbs_g || 0}g F:${item.fat_g || 0}g</div>
      </div>`).join('');
    list.classList.add('visible');
  },

  async selectFoodLibraryItem(id) {
    const item = await DB.getFoodItem(id);
    if (!item) return;
    document.getElementById('food-search').value = item.name;
    document.getElementById('food-library-id').value = item.id;
    document.getElementById('food-ingredients').value = item.ingredients || '';
    document.getElementById('food-serving-desc').value = item.servingDescription || '';
    document.getElementById('food-calories').value = item.calories || '';
    document.getElementById('food-protein').value = item.protein_g || '';
    document.getElementById('food-carbs').value = item.carbs_g || '';
    document.getElementById('food-fat').value = item.fat_g || '';
    document.getElementById('food-sodium').value = item.sodium_mg || '';
    document.getElementById('food-autocomplete').classList.remove('visible');
  },

  async saveFoodEntry() {
    const foodName = document.getElementById('food-search').value.trim();
    if (!foodName) {
      UI.showToast('Please enter a food name', 'error');
      return;
    }

    const quantity = parseFloat(document.getElementById('food-quantity').value) || 1;
    const calories_per = parseFloat(document.getElementById('food-calories').value) || 0;
    const protein_per = parseFloat(document.getElementById('food-protein').value) || 0;
    const carbs_per = parseFloat(document.getElementById('food-carbs').value) || 0;
    const fat_per = parseFloat(document.getElementById('food-fat').value) || 0;
    const sodium_per = parseFloat(document.getElementById('food-sodium').value) || 0;

    let foodId = document.getElementById('food-library-id').value;

    // Create or update library item
    if (!foodId) {
      const libItem = await DB.addFoodItem({
        name: foodName,
        ingredients: document.getElementById('food-ingredients').value.trim(),
        servingDescription: document.getElementById('food-serving-desc').value.trim(),
        calories: calories_per,
        protein_g: protein_per,
        carbs_g: carbs_per,
        fat_g: fat_per,
        sodium_mg: sodium_per
      });
      foodId = libItem.id;
    }

    const data = {
      eventType: 'food',
      foodId,
      foodName,
      quantity,
      servingDescription: document.getElementById('food-serving-desc').value.trim(),
      ingredients: document.getElementById('food-ingredients').value.trim(),
      calories: Math.round(calories_per * quantity),
      protein_g: Math.round(protein_per * quantity * 10) / 10,
      carbs_g: Math.round(carbs_per * quantity * 10) / 10,
      fat_g: Math.round(fat_per * quantity * 10) / 10,
      sodium_mg: Math.round(sodium_per * quantity),
      timestamp: new Date(document.getElementById('food-timestamp').value).toISOString(),
      notes: document.getElementById('food-notes').value.trim()
    };

    if (this._editingEventId) {
      await DB.updateEvent(this._editingEventId, data);
      UI.showToast('Food entry updated', 'success');
    } else {
      await DB.addEvent(data);
      UI.showToast(`${foodName} logged`, 'success');
    }
    UI.closeModal();
    this._editingEventId = null;
    await this.renderCurrentTab();
  },

  /* ---------- Drink Entry ---------- */
  openDrinkEntry(existingData = null) {
    this._editingEventId = existingData?.id || null;
    const title = existingData ? 'Edit Drink' : 'Log Drink';
    const body = UI.buildDrinkEntryForm(existingData);
    const footer = `
      ${existingData ? '<button class="btn btn-danger btn-sm" style="margin-bottom:8px" onclick="App.deleteCurrentEntry()">Delete Entry</button>' : ''}
      <button class="btn btn-primary" onclick="App.saveDrinkEntry()">Save</button>`;
    UI.openModal(title, body, footer);

    setTimeout(() => {
      const searchInput = document.getElementById('drink-search');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => this._drinkAutocomplete(e.target.value));
        searchInput.addEventListener('focus', (e) => this._drinkAutocomplete(e.target.value));
      }
    }, 100);
  },

  async _drinkAutocomplete(query) {
    const list = document.getElementById('drink-autocomplete');
    if (!query || query.length < 2) {
      list.classList.remove('visible');
      return;
    }
    const results = await DB.searchDrinkLibrary(query);
    if (results.length === 0) {
      list.classList.remove('visible');
      return;
    }
    list.innerHTML = results.map(item => `
      <div class="autocomplete-item" onclick="App.selectDrinkLibraryItem('${item.id}')">
        <div class="item-name">${item.name}</div>
        <div class="item-detail">${item.defaultVolume_ml || 250} mL</div>
      </div>`).join('');
    list.classList.add('visible');
  },

  async selectDrinkLibraryItem(id) {
    const item = await DB.getDrinkItem(id);
    if (!item) return;
    document.getElementById('drink-search').value = item.name;
    document.getElementById('drink-library-id').value = item.id;
    document.getElementById('drink-ingredients').value = item.ingredients || '';
    document.getElementById('drink-volume').value = item.defaultVolume_ml || 250;
    document.getElementById('drink-calories').value = item.calories || '';
    document.getElementById('drink-protein').value = item.protein_g || '';
    document.getElementById('drink-carbs').value = item.carbs_g || '';
    document.getElementById('drink-fat').value = item.fat_g || '';
    document.getElementById('drink-sodium').value = item.sodium_mg || '';
    document.getElementById('drink-caffeine').value = item.caffeine_mg || '';
    document.getElementById('drink-autocomplete').classList.remove('visible');
  },

  async saveDrinkEntry() {
    const drinkName = document.getElementById('drink-search').value.trim();
    if (!drinkName) {
      UI.showToast('Please enter a drink name', 'error');
      return;
    }

    const volume_ml = parseInt(document.getElementById('drink-volume').value) || 250;
    let drinkId = document.getElementById('drink-library-id').value;

    const ingredients = document.getElementById('drink-ingredients').value.trim();
    const calories = parseFloat(document.getElementById('drink-calories').value) || 0;

    if (!drinkId) {
      const libItem = await DB.addDrinkItem({
        name: drinkName,
        ingredients,
        defaultVolume_ml: volume_ml,
        calories,
        protein_g: parseFloat(document.getElementById('drink-protein').value) || 0,
        carbs_g: parseFloat(document.getElementById('drink-carbs').value) || 0,
        fat_g: parseFloat(document.getElementById('drink-fat').value) || 0,
        sodium_mg: parseFloat(document.getElementById('drink-sodium').value) || 0,
        caffeine_mg: parseFloat(document.getElementById('drink-caffeine').value) || 0
      });
      drinkId = libItem.id;
    }

    const data = {
      eventType: 'drink',
      drinkId,
      drinkName,
      ingredients,
      volume_ml,
      calories,
      protein_g: parseFloat(document.getElementById('drink-protein').value) || 0,
      carbs_g: parseFloat(document.getElementById('drink-carbs').value) || 0,
      fat_g: parseFloat(document.getElementById('drink-fat').value) || 0,
      sodium_mg: parseFloat(document.getElementById('drink-sodium').value) || 0,
      caffeine_mg: parseFloat(document.getElementById('drink-caffeine').value) || 0,
      timestamp: new Date(document.getElementById('drink-timestamp').value).toISOString(),
      notes: document.getElementById('drink-notes').value.trim()
    };

    if (this._editingEventId) {
      await DB.updateEvent(this._editingEventId, data);
      UI.showToast('Drink entry updated', 'success');
    } else {
      await DB.addEvent(data);
      UI.showToast(`${drinkName} — ${volume_ml} mL logged`, 'success');
    }
    UI.closeModal();
    this._editingEventId = null;
    await this.renderCurrentTab();
  },

  /* ---------- Medication Checklist ---------- */
  async openMedicationChecklist() {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'AM' : 'PM';
    const schedule = hour < 12 ? 'Morning' : 'Evening';

    const meds = await DB.getMedicationsBySchedule(schedule);
    const title = `${schedule} Medications`;
    const body = UI.buildMedChecklist(meds, schedule);
    const footer = `<button class="btn btn-primary" onclick="App.saveMedicationChecklist('${timeOfDay}')">Confirm</button>`;
    UI.openModal(title, body, footer);
  },

  toggleMedCheck(index) {
    const el = document.getElementById(`med-check-${index}`);
    el.classList.toggle('checked');
    if (el.classList.contains('checked')) {
      el.innerHTML = '<i data-lucide="check"></i>';
    } else {
      el.innerHTML = '';
    }
    lucide.createIcons();
  },

  async saveMedicationChecklist(timeOfDay) {
    const checkboxes = document.querySelectorAll('.med-checkbox');
    for (const cb of checkboxes) {
      const medId = cb.dataset.medId;
      const med = await DB.getMedication(medId);
      if (!med) continue;

      await DB.addEvent({
        eventType: 'medication',
        medName: med.name,
        dosage: med.dosage,
        status: cb.classList.contains('checked') ? 'Taken' : 'Skipped',
        timeOfDay,
        timestamp: new Date().toISOString()
      });
    }
    UI.closeModal();
    UI.showToast('Medications logged', 'success');
    await this.renderCurrentTab();
  },

  async logVentolin(context) {
    await DB.addEvent({
      eventType: 'ventolin',
      context,
      timestamp: new Date().toISOString()
    });
    UI.showToast(`Ventolin (${context}) logged`, 'success');
  },

  /* ---------- Edit / Delete ---------- */
  async editEntry(id) {
    let event;
    let isDemo = false;

    // Check if this is a demo entry
    if (typeof id === 'string' && id.startsWith('demo-')) {
      isDemo = true;
      const demoEvents = Demo.getEvents();
      event = demoEvents.find(e => e.id === id);
      if (!event) {
        UI.showToast('Demo entry not found', 'error');
        return;
      }
    } else {
      event = await DB.getEvent(id);
      if (!event) {
        UI.showToast('Entry not found', 'error');
        return;
      }
    }

    switch (event.eventType) {
      case 'bp_hr': this.openBpEntry(event); break;
      case 'weight': this.openWeightEntry(event); break;
      case 'steps': this.openStepsEntry(event); break;
      case 'food': this.openFoodEntry(event); break;
      case 'drink': this.openDrinkEntry(event); break;
      case 'afib':
      case 'sleep':
      case 'walk':
        this.openToggleEdit(event); break;
      case 'medication':
        this.openMedEdit(event); break;
      case 'ventolin':
        this.openVentolinEdit(event); break;
    }

    // If demo, make the modal read-only: disable Save, show demo banner
    if (isDemo) {
      setTimeout(() => {
        // Disable all save/delete buttons in the modal
        const modalFooter = document.getElementById('modal-footer');
        if (modalFooter) {
          modalFooter.innerHTML = `
            <div style="text-align:center;padding:var(--space-sm) 0;color:var(--text-tertiary);font-size:var(--font-sm);font-weight:500;">
              <i data-lucide="eye" style="width:14px;height:14px;display:inline;vertical-align:-2px;"></i>
              Demo data — view only
            </div>`;
          lucide.createIcons({ nodes: [modalFooter] });
        }
        // Make all inputs read-only
        const overlay = document.getElementById('modal-overlay');
        if (overlay) {
          overlay.querySelectorAll('input, textarea, select').forEach(el => {
            el.setAttribute('readonly', true);
            el.setAttribute('disabled', true);
            el.style.opacity = '0.7';
          });
          overlay.querySelectorAll('.toggle-option, .med-checkbox').forEach(el => {
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.7';
          });
        }
      }, 80);
    }
  },

  openToggleEdit(event) {
    this._editingEventId = event.id;
    const typeLabel = { afib: 'AFib Episode', sleep: 'Sleep', walk: 'Walk' }[event.eventType];
    const body = UI.buildEditForm(event);
    const footer = `
      <button class="btn btn-danger btn-sm" style="margin-bottom:8px" onclick="App.deleteCurrentEntry()">Delete Entry</button>
      <button class="btn btn-primary" onclick="App.saveToggleEdit('${event.eventType}')">Save</button>`;
    UI.openModal(`Edit ${typeLabel}`, body, footer);
  },

  async saveToggleEdit(eventType) {
    const startTime = new Date(document.getElementById('toggle-start').value).toISOString();
    const endVal = document.getElementById('toggle-end').value;
    const endTime = endVal ? new Date(endVal).toISOString() : null;
    let duration_min = null;
    if (startTime && endTime) {
      duration_min = Math.round((new Date(endTime) - new Date(startTime)) / 60000);
    }
    await DB.updateEvent(this._editingEventId, {
      startTime, endTime, duration_min,
      timestamp: startTime,
      notes: document.getElementById('toggle-notes').value.trim()
    });
    UI.closeModal();
    this._editingEventId = null;
    UI.showToast('Entry updated', 'success');
    await this.renderCurrentTab();
  },

  openMedEdit(event) {
    this._editingEventId = event.id;
    const body = UI.buildEditForm(event);
    const footer = `
      <button class="btn btn-danger btn-sm" style="margin-bottom:8px" onclick="App.deleteCurrentEntry()">Delete Entry</button>
      <button class="btn btn-primary" onclick="App.saveMedEdit()">Save</button>`;
    UI.openModal('Edit Medication Entry', body, footer);
    this.setupToggleGroupListeners();
  },

  async saveMedEdit() {
    await DB.updateEvent(this._editingEventId, {
      dosage: document.getElementById('med-edit-dosage').value.trim(),
      status: this._getToggleValue('med-edit-status') || 'Taken',
      timestamp: new Date(document.getElementById('med-edit-timestamp').value).toISOString(),
      notes: document.getElementById('med-edit-notes').value.trim()
    });
    UI.closeModal();
    this._editingEventId = null;
    UI.showToast('Medication entry updated', 'success');
    await this.renderCurrentTab();
  },

  openVentolinEdit(event) {
    this._editingEventId = event.id;
    const body = UI.buildEditForm(event);
    const footer = `
      <button class="btn btn-danger btn-sm" style="margin-bottom:8px" onclick="App.deleteCurrentEntry()">Delete Entry</button>
      <button class="btn btn-primary" onclick="App.saveVentolinEdit()">Save</button>`;
    UI.openModal('Edit Ventolin Entry', body, footer);
    this.setupToggleGroupListeners();
  },

  async saveVentolinEdit() {
    await DB.updateEvent(this._editingEventId, {
      context: this._getToggleValue('ventolin-edit-ctx') || 'Reactive',
      timestamp: new Date(document.getElementById('ventolin-edit-timestamp').value).toISOString(),
      notes: document.getElementById('ventolin-edit-notes').value.trim()
    });
    UI.closeModal();
    this._editingEventId = null;
    UI.showToast('Ventolin entry updated', 'success');
    await this.renderCurrentTab();
  },

  async deleteCurrentEntry() {
    if (!this._editingEventId) return;
    const confirmed = await UI.confirm('Delete Entry', 'Are you sure you want to delete this entry? This cannot be undone.');
    if (!confirmed) return;

    await DB.deleteEvent(this._editingEventId);
    UI.closeModal();
    this._editingEventId = null;
    UI.showToast('Entry deleted', 'info');
    await this.renderCurrentTab();
  },

  /* ---------- History ---------- */
  async refreshHistory() {
    let events;
    if (this.historyFilters.includes('all')) {
      events = await DataSource.getAllEvents(null, 200);
    } else {
      events = await DataSource.getEventsByTypes(this.historyFilters, 200);
    }
    UI.renderHistory(events, this.historyFilters);
  },

  openHistoryFiltered(filterKey) {
    this.historyFilters = [filterKey];
    this.switchTab('history');
  },

  toggleHistoryFilter(key) {
    if (key === 'all') {
      this.historyFilters = ['all'];
    } else {
      this.historyFilters = this.historyFilters.filter(f => f !== 'all');
      const idx = this.historyFilters.indexOf(key);
      if (idx >= 0) {
        this.historyFilters.splice(idx, 1);
      } else {
        this.historyFilters.push(key);
      }
      if (this.historyFilters.length === 0) {
        this.historyFilters = ['all'];
      }
    }
    this.refreshHistory();
  },

  /* ---------- Dashboard ---------- */
  toggleDashboardLayer(layer) {
    const idx = this.dashboardLayers.indexOf(layer);
    if (idx >= 0) {
      this.dashboardLayers.splice(idx, 1);
    } else {
      this.dashboardLayers.push(layer);
    }
    // Update chip UI
    document.querySelectorAll('#dashboard-chips .filter-chip').forEach(chip => {
      chip.classList.toggle('active', this.dashboardLayers.includes(chip.dataset.layer));
    });
    Charts.renderDashboard(this.dashboardLayers, this.dashboardRange);
  },

  setDashboardRange(range) {
    this.dashboardRange = range;
    document.querySelectorAll('#dashboard-range .time-range-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.toLowerCase().replace(/\s/g, '') === range ||
        (range === '3months' && btn.textContent === '3M') ||
        (range === 'all' && btn.textContent === 'All'));
    });
    Charts.renderDashboard(this.dashboardLayers, this.dashboardRange);
  },

  setDashboardPreset(preset) {
    const presets = {
      afib: ['afib', 'sleep', 'medication'],
      weight: ['weight', 'food', 'walk'],
      heart: ['bp', 'hr', 'afib', 'medication']
    };
    this.dashboardLayers = presets[preset] || [];
    document.querySelectorAll('#dashboard-chips .filter-chip').forEach(chip => {
      chip.classList.toggle('active', this.dashboardLayers.includes(chip.dataset.layer));
    });
    Charts.renderDashboard(this.dashboardLayers, this.dashboardRange);
  },

  /* ---------- Medication Reminders ---------- */
  async checkMedicationReminders() {
    const hour = new Date().getHours();

    if (hour < 12) {
      // Morning: check if PM meds were confirmed yesterday
      const pmMeds = await DB.getYesterdayMedStatus('PM');
      if (pmMeds.length === 0) {
        const meds = await DB.getMedicationsBySchedule('Evening');
        if (meds.length > 0) {
          this._showMedReminder('PM', 'Did you take your evening medications last night?');
        }
      }
    } else {
      // Afternoon/Evening: check if AM meds were confirmed today
      const amMeds = await DB.getTodayMedStatus('AM');
      if (amMeds.length === 0) {
        const meds = await DB.getMedicationsBySchedule('Morning');
        if (meds.length > 0) {
          this._showMedReminder('AM', 'Did you take your morning medications today?');
        }
      }
    }
  },

  _showMedReminder(timeOfDay, message) {
    const overlay = document.createElement('div');
    overlay.className = 'reminder-popup';
    overlay.id = 'med-reminder';
    overlay.innerHTML = `
      <div class="reminder-card">
        <h3>Medication Reminder</h3>
        <p>${message}</p>
        <div class="reminder-actions">
          <button class="btn btn-primary" onclick="App.confirmAllMeds('${timeOfDay}')">Yes, all taken</button>
          <button class="btn btn-secondary" onclick="App.openMedReminderChecklist('${timeOfDay}')">Let me check</button>
          <button class="btn btn-ghost" onclick="document.getElementById('med-reminder').remove()">Dismiss</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  },

  async confirmAllMeds(timeOfDay) {
    const schedule = timeOfDay === 'AM' ? 'Morning' : 'Evening';
    const meds = await DB.getMedicationsBySchedule(schedule);
    let estimatedTime;
    if (timeOfDay === 'AM') {
      estimatedTime = new Date(UI.todayStr() + 'T08:00:00').toISOString();
    } else {
      const yd = new Date();
      yd.setDate(yd.getDate() - 1);
      const yds = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`;
      estimatedTime = new Date(yds + 'T20:00:00').toISOString();
    }

    for (const med of meds) {
      await DB.addEvent({
        eventType: 'medication',
        medName: med.name,
        dosage: med.dosage,
        status: 'Taken',
        timeOfDay,
        timestamp: estimatedTime
      });
    }
    document.getElementById('med-reminder')?.remove();
    UI.showToast('Medications confirmed', 'success');
  },

  openMedReminderChecklist(timeOfDay) {
    document.getElementById('med-reminder')?.remove();
    this.openMedicationChecklist();
  },

  /* ---------- Settings Pages ---------- */
  async openSettingsPage(page) {
    switch (page) {
      case 'medications':
        await this._openMedicationSettings(); break;
      case 'foodLibrary':
        await this._openLibrarySettings('food'); break;
      case 'drinkLibrary':
        await this._openLibrarySettings('drink'); break;
      case 'userInfo':
        await this._openUserInfoSettings(); break;
      case 'goals':
        await this._openGoalsSettings(); break;
      case 'notifications':
        this._openNotificationSettings(); break;
    }
  },

  async _openMedicationSettings() {
    const meds = await DB.getMedications();
    let html = '<div class="entry-list">';
    meds.forEach(med => {
      html += `
        <div class="entry-item" onclick="App.editMedication('${med.id}')">
          <div class="entry-icon med"><i data-lucide="pill"></i></div>
          <div class="entry-body">
            <div class="entry-title">${med.name}</div>
            <div class="entry-subtitle">${med.dosage} — ${med.schedule}</div>
          </div>
          <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-tertiary)"></i>
        </div>`;
    });
    html += '</div>';
    html += `<div style="padding:var(--space-md)"><button class="btn btn-secondary" onclick="App.addNewMedication()"><i data-lucide="plus"></i> Add Medication</button></div>`;

    UI.openFullscreenModal('Medication List', html, null);
  },

  async editMedication(id) {
    const med = await DB.getMedication(id);
    if (!med) return;
    const body = `
      <div class="form-group">
        <label>Name</label>
        <input type="text" class="form-input" id="med-setting-name" value="${med.name}">
      </div>
      <div class="form-group">
        <label>Dosage</label>
        <input type="text" class="form-input" id="med-setting-dosage" value="${med.dosage}">
      </div>
      <div class="form-group">
        <label>Schedule</label>
        <div class="toggle-group" id="med-setting-schedule">
          <button class="toggle-option${med.schedule === 'Morning' ? ' active' : ''}" data-value="Morning">Morning</button>
          <button class="toggle-option${med.schedule === 'Evening' ? ' active' : ''}" data-value="Evening">Evening</button>
          <button class="toggle-option${med.schedule === 'Both' ? ' active' : ''}" data-value="Both">Both</button>
        </div>
      </div>`;
    const footer = `
      <button class="btn btn-danger btn-sm" style="margin-bottom:8px" onclick="App.deleteMedication('${id}')">Delete Medication</button>
      <button class="btn btn-primary" onclick="App.saveMedicationSetting('${id}')">Save</button>`;
    UI.closeFullscreenModal();
    setTimeout(() => {
      UI.openModal('Edit Medication', body, footer);
      this.setupToggleGroupListeners();
    }, 350);
  },

  async saveMedicationSetting(id) {
    await DB.updateMedication(id, {
      name: document.getElementById('med-setting-name').value.trim(),
      dosage: document.getElementById('med-setting-dosage').value.trim(),
      schedule: this._getToggleValue('med-setting-schedule') || 'Morning'
    });
    UI.closeModal();
    UI.showToast('Medication updated', 'success');
  },

  addNewMedication() {
    const body = `
      <div class="form-group">
        <label>Name</label>
        <input type="text" class="form-input" id="med-setting-name" placeholder="Medication name">
      </div>
      <div class="form-group">
        <label>Dosage</label>
        <input type="text" class="form-input" id="med-setting-dosage" placeholder="e.g., 1 tablet, 40mg">
      </div>
      <div class="form-group">
        <label>Schedule</label>
        <div class="toggle-group" id="med-setting-schedule">
          <button class="toggle-option" data-value="Morning">Morning</button>
          <button class="toggle-option" data-value="Evening">Evening</button>
          <button class="toggle-option active" data-value="Both">Both</button>
        </div>
      </div>`;
    const footer = `<button class="btn btn-primary" onclick="App.saveNewMedication()">Add</button>`;
    UI.closeFullscreenModal();
    setTimeout(() => {
      UI.openModal('Add Medication', body, footer);
      this.setupToggleGroupListeners();
    }, 350);
  },

  async saveNewMedication() {
    const name = document.getElementById('med-setting-name').value.trim();
    if (!name) { UI.showToast('Please enter a name', 'error'); return; }
    await DB.addMedication({
      name,
      dosage: document.getElementById('med-setting-dosage').value.trim(),
      schedule: this._getToggleValue('med-setting-schedule') || 'Both'
    });
    UI.closeModal();
    UI.showToast('Medication added', 'success');
  },

  async deleteMedication(id) {
    const confirmed = await UI.confirm('Delete Medication', 'Remove this medication from your list?');
    if (!confirmed) return;
    await DB.deleteMedication(id);
    UI.closeModal();
    UI.showToast('Medication removed', 'info');
  },

  async _openLibrarySettings(type) {
    const items = type === 'food' ? await DB.getAllFoodItems() : await DB.getAllDrinkItems();
    const label = type === 'food' ? 'Food' : 'Drink';
    let html = '<div class="entry-list">';
    if (items.length === 0) {
      html += `<div class="empty-state"><i data-lucide="${type === 'food' ? 'utensils' : 'droplets'}"></i><p>No ${label.toLowerCase()} items yet. They'll appear here as you log.</p></div>`;
    } else {
      items.forEach(item => {
        html += `
          <div class="entry-item" onclick="App.editLibraryItem('${type}', '${item.id}')">
            <div class="entry-icon ${type}"><i data-lucide="${type === 'food' ? 'utensils' : 'droplets'}"></i></div>
            <div class="entry-body">
              <div class="entry-title">${item.name}</div>
              <div class="entry-subtitle">${item.calories ? item.calories + ' kcal · ' : ''}P:${item.protein_g || 0}g C:${item.carbs_g || 0}g F:${item.fat_g || 0}g${item.caffeine_mg ? ' · ☕' + item.caffeine_mg + 'mg' : ''}</div>
            </div>
            <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-tertiary)"></i>
          </div>`;
      });
    }
    html += '</div>';
    UI.openFullscreenModal(`${label} Library`, html, null);
  },

  async editLibraryItem(type, id) {
    const item = type === 'food' ? await DB.getFoodItem(id) : await DB.getDrinkItem(id);
    if (!item) return;

    let body;
    if (type === 'food') {
      body = `
        <div class="form-group"><label>Name</label><input type="text" class="form-input" id="lib-name" value="${item.name}"></div>
        <div class="form-group"><label>Ingredients</label><textarea class="form-input" id="lib-ingredients">${item.ingredients || ''}</textarea></div>
        <div class="form-group"><label>Serving Description</label><input type="text" class="form-input" id="lib-serving" value="${item.servingDescription || ''}"></div>
        <div class="form-group"><label>Calories (kcal)</label><input type="number" class="form-input" id="lib-calories" value="${item.calories || 0}"></div>
        <div class="input-row">
          <div class="form-group"><label>Protein (g)</label><input type="number" class="form-input" id="lib-protein" value="${item.protein_g || 0}"></div>
          <div class="form-group"><label>Carbs (g)</label><input type="number" class="form-input" id="lib-carbs" value="${item.carbs_g || 0}"></div>
        </div>
        <div class="input-row">
          <div class="form-group"><label>Fat (g)</label><input type="number" class="form-input" id="lib-fat" value="${item.fat_g || 0}"></div>
          <div class="form-group"><label>Sodium (mg)</label><input type="number" class="form-input" id="lib-sodium" value="${item.sodium_mg || 0}"></div>
        </div>`;
    } else {
      body = `
        <div class="form-group"><label>Name</label><input type="text" class="form-input" id="lib-name" value="${item.name}"></div>
        <div class="form-group"><label>Ingredients</label><textarea class="form-input" id="lib-ingredients">${item.ingredients || ''}</textarea></div>
        <div class="form-group"><label>Default Volume (mL)</label><input type="number" class="form-input" id="lib-volume" value="${item.defaultVolume_ml || 250}"></div>
        <div class="form-group"><label>Calories (kcal)</label><input type="number" class="form-input" id="lib-calories" value="${item.calories || 0}"></div>
        <div class="input-row">
          <div class="form-group"><label>Protein (g)</label><input type="number" class="form-input" id="lib-protein" value="${item.protein_g || 0}"></div>
          <div class="form-group"><label>Carbs (g)</label><input type="number" class="form-input" id="lib-carbs" value="${item.carbs_g || 0}"></div>
        </div>
        <div class="input-row">
          <div class="form-group"><label>Fat (g)</label><input type="number" class="form-input" id="lib-fat" value="${item.fat_g || 0}"></div>
          <div class="form-group"><label>Sodium (mg)</label><input type="number" class="form-input" id="lib-sodium" value="${item.sodium_mg || 0}"></div>
        </div>
        <div class="form-group"><label>Caffeine (mg)</label><input type="number" class="form-input" id="lib-caffeine" value="${item.caffeine_mg || 0}"></div>`;
    }

    const footer = `
      <button class="btn btn-danger btn-sm" style="margin-bottom:8px" onclick="App.deleteLibraryItem('${type}', '${id}')">Delete</button>
      <button class="btn btn-primary" onclick="App.saveLibraryItem('${type}', '${id}')">Save</button>`;
    UI.closeFullscreenModal();
    setTimeout(() => UI.openModal(`Edit ${type === 'food' ? 'Food' : 'Drink'} Item`, body, footer), 350);
  },

  async saveLibraryItem(type, id) {
    const updates = {
      name: document.getElementById('lib-name').value.trim(),
      calories: parseFloat(document.getElementById('lib-calories').value) || 0,
      protein_g: parseFloat(document.getElementById('lib-protein').value) || 0,
      carbs_g: parseFloat(document.getElementById('lib-carbs').value) || 0,
      fat_g: parseFloat(document.getElementById('lib-fat').value) || 0,
      sodium_mg: parseFloat(document.getElementById('lib-sodium').value) || 0
    };
    // Both food and drink now have ingredients
    const ingredientsEl = document.getElementById('lib-ingredients');
    if (ingredientsEl) updates.ingredients = ingredientsEl.value.trim();
    if (type === 'food') {
      updates.servingDescription = document.getElementById('lib-serving').value.trim();
      await DB.updateFoodItem(id, updates);
    } else {
      updates.defaultVolume_ml = parseInt(document.getElementById('lib-volume').value) || 250;
      updates.caffeine_mg = parseFloat(document.getElementById('lib-caffeine').value) || 0;
      await DB.updateDrinkItem(id, updates);
    }
    UI.closeModal();
    UI.showToast('Library item updated', 'success');
  },

  async deleteLibraryItem(type, id) {
    const confirmed = await UI.confirm('Delete Item', 'Remove this item from the library? Existing log entries won\'t be affected.');
    if (!confirmed) return;
    if (type === 'food') await DB.deleteFoodItem(id);
    else await DB.deleteDrinkItem(id);
    UI.closeModal();
    UI.showToast('Item removed', 'info');
  },

  async _openUserInfoSettings() {
    const userName = await DB.getSetting('userName') || 'Matt Allan';
    const userDOB = await DB.getSetting('userDOB') || '1973-06-16';
    const userHeight = await DB.getSetting('userHeight') || 190;

    const body = `
      <div class="form-group"><label>Name</label><input type="text" class="form-input" id="setting-name" value="${userName}"></div>
      <div class="form-group"><label>Date of Birth</label><input type="date" class="form-input" id="setting-dob" value="${userDOB}"></div>
      <div class="form-group"><label>Height (cm)</label><input type="number" class="form-input" id="setting-height" value="${userHeight}"></div>`;
    const footer = `<button class="btn btn-primary" onclick="App.saveUserInfo()">Save</button>`;
    UI.openModal('User Information', body, footer);
  },

  async saveUserInfo() {
    await DB.setSetting('userName', document.getElementById('setting-name').value.trim());
    await DB.setSetting('userDOB', document.getElementById('setting-dob').value);
    await DB.setSetting('userHeight', parseInt(document.getElementById('setting-height').value));
    UI.closeModal();
    UI.showToast('User info updated', 'success');
  },

  async _openGoalsSettings() {
    const proteinGoal = await DB.getSetting('proteinGoal') || '';
    const carbLimit = await DB.getSetting('carbLimit') || '';
    const fluidGoal = await DB.getSetting('fluidGoal') || '';

    const body = `
      <div class="form-group"><label>Daily Protein Goal (g)</label><input type="number" class="form-input" id="setting-protein" value="${proteinGoal}" placeholder="e.g., 120"></div>
      <div class="form-group"><label>Daily Carb Limit (g)</label><input type="number" class="form-input" id="setting-carbs" value="${carbLimit}" placeholder="e.g., 100"></div>
      <div class="form-group"><label>Daily Fluid Goal (mL)</label><input type="number" class="form-input" id="setting-fluid" value="${fluidGoal}" placeholder="e.g., 2000"></div>`;
    const footer = `<button class="btn btn-primary" onclick="App.saveGoals()">Save</button>`;
    UI.openModal('Nutritional Goals', body, footer);
  },

  async saveGoals() {
    await DB.setSetting('proteinGoal', parseInt(document.getElementById('setting-protein').value) || null);
    await DB.setSetting('carbLimit', parseInt(document.getElementById('setting-carbs').value) || null);
    await DB.setSetting('fluidGoal', parseInt(document.getElementById('setting-fluid').value) || null);
    UI.closeModal();
    UI.showToast('Goals updated', 'success');
  },

  _openNotificationSettings() {
    const body = `
      <div style="padding:var(--space-md);text-align:center;">
        <p style="color:var(--text-secondary);margin-bottom:var(--space-lg);">Push notifications for medication reminders.</p>
        <button class="btn btn-primary" onclick="Notifications.requestPermission()">Enable Notifications</button>
        <p style="color:var(--text-tertiary);font-size:var(--font-xs);margin-top:var(--space-md);">Note: On iOS, PWA push notifications require iOS 16.4+. In-app reminders always work as a fallback.</p>
      </div>`;
    UI.openModal('Notification Preferences', body, '');
  },

  /* ---------- Export Handlers ---------- */
  async exportCSV() {
    try {
      await Export.generateCSV();
      UI.showToast('CSV exported', 'success');
    } catch (e) {
      UI.showToast('Export failed: ' + e.message, 'error');
    }
  },

  async exportPDF() {
    try {
      await Export.generatePDF();
      UI.showToast('PDF generated', 'success');
    } catch (e) {
      UI.showToast('PDF generation failed: ' + e.message, 'error');
    }
  },

  async exportJSON() {
    try {
      const data = await DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `heart-tracker-backup-${UI.todayStr()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      UI.showToast('Backup exported', 'success');
    } catch (e) {
      UI.showToast('Export failed: ' + e.message, 'error');
    }
  },

  importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const confirmed = await UI.confirm('Restore Backup', 'This will replace ALL current data. Are you sure?');
        if (!confirmed) return;
        await DB.importAll(data);
        UI.showToast('Backup restored successfully', 'success');
        await this.loadToggleStates();
        await this.renderCurrentTab();
      } catch (e) {
        UI.showToast('Import failed: ' + e.message, 'error');
      }
    };
    input.click();
  },

  /* ---------- Version Check ---------- */
  async checkForUpdates() {
    try {
      const response = await fetch('version.json?t=' + Date.now());
      const remote = await response.json();
      if (remote.version !== this.APP_VERSION) {
        this._showUpdateBanner(remote.version);
      } else {
        UI.showToast('App is up to date!', 'success');
      }
    } catch (e) {
      UI.showToast('Could not check for updates', 'error');
    }
  },

  /* Silent auto-check on launch (no error toast if offline) */
  async _autoCheckForUpdates() {
    try {
      const response = await fetch('version.json?t=' + Date.now());
      const remote = await response.json();
      if (remote.version !== this.APP_VERSION) {
        this._showUpdateBanner(remote.version);
      }
      // Also detect a waiting service worker
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          // If a new SW is already waiting, show the banner
          if (reg.waiting) this._showUpdateBanner(remote.version);
          // Listen for future updates
          reg.addEventListener('updatefound', () => {
            const newSW = reg.installing;
            if (newSW) {
              newSW.addEventListener('statechange', () => {
                if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                  this._showUpdateBanner();
                }
              });
            }
          });
        }
      }
    } catch (e) {
      // Offline — silently skip
    }
  },

  _showUpdateBanner(version) {
    // Don't show multiple banners
    if (document.getElementById('update-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.innerHTML = `
      <div class="update-banner">
        <span>🔄 Update available${version ? ' (v' + version + ')' : ''}</span>
        <button onclick="location.reload(true)">Refresh Now</button>
        <button class="dismiss" onclick="this.closest('.update-banner').remove()">✕</button>
      </div>`;
    document.body.prepend(banner);
  },

  /* ---------- Modal Helpers ---------- */
  closeModal() {
    UI.closeModal();
    this._editingEventId = null;
  },

  closeFullscreenModal() {
    UI.closeFullscreenModal();
  },

  saveFullscreenModal() {
    if (this._fullscreenSaveHandler) {
      this._fullscreenSaveHandler();
    }
  },

  /* ---------- Toggle Group Listener ---------- */
  setupToggleGroupListeners() {
    setTimeout(() => {
      document.querySelectorAll('.toggle-group').forEach(group => {
        group.querySelectorAll('.toggle-option').forEach(opt => {
          opt.addEventListener('click', (e) => {
            const parent = e.target.closest('.toggle-group');
            const wasActive = e.target.classList.contains('active');
            parent.querySelectorAll('.toggle-option').forEach(o => o.classList.remove('active'));
            if (!wasActive) e.target.classList.add('active');
          });
        });
      });
    }, 50);
  },

  _getToggleValue(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return null;
    const active = group.querySelector('.toggle-option.active');
    return active ? active.dataset.value : null;
  },

  /* ---------- Stats Calculators ---------- */
  _calcAfibStats(events) {
    const completed = events.filter(e => e.endTime);
    const thisWeek = completed.filter(e => {
      const d = new Date(e.timestamp);
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      return d >= weekAgo;
    });
    const thisMonth = completed.filter(e => {
      const d = new Date(e.timestamp);
      const monthAgo = new Date(Date.now() - 30 * 86400000);
      return d >= monthAgo;
    });
    const avgDuration = completed.length > 0
      ? Math.round(completed.reduce((s, e) => s + (e.duration_min || 0), 0) / completed.length)
      : 0;
    const longestEpisode = completed.length > 0
      ? Math.max(...completed.map(e => e.duration_min || 0))
      : 0;

    return [
      { label: 'This Week', value: thisWeek.length, unit: 'episodes' },
      { label: 'This Month', value: thisMonth.length, unit: 'episodes' },
      { label: 'Avg Duration', value: UI.formatDuration(avgDuration) },
      { label: 'Longest', value: UI.formatDuration(longestEpisode) }
    ];
  },

  _calcBpStats(events) {
    if (events.length === 0) return [];
    const latest = events[0];
    const sysValues = events.filter(e => e.systolic).map(e => e.systolic);
    const diaValues = events.filter(e => e.diastolic).map(e => e.diastolic);
    const hrValues = events.filter(e => e.heartRate).map(e => e.heartRate);

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b) / arr.length) : '—';
    const cat = UI.bpCategory(latest.systolic, latest.diastolic);
    const avgCat = UI.bpCategory(avg(sysValues), avg(diaValues));

    return [
      { label: 'Latest', value: `${latest.systolic || '—'}/${latest.diastolic || '—'}`, unit: 'mmHg', color: cat.color, bg: cat.bg, badge: cat.label },
      { label: 'Latest HR', value: latest.heartRate || '—', unit: 'BPM' },
      { label: 'Average', value: `${avg(sysValues)}/${avg(diaValues)}`, unit: 'mmHg', color: avgCat.color, bg: avgCat.bg, badge: avgCat.label },
      { label: 'Avg HR', value: avg(hrValues), unit: 'BPM' }
    ];
  },

  _calcSleepStats(events) {
    const completed = events.filter(e => e.endTime);
    if (completed.length === 0) return [];
    const durations = completed.map(e => e.duration_min || 0);
    const avg = Math.round(durations.reduce((a, b) => a + b) / durations.length);
    const best = Math.max(...durations);
    const worst = Math.min(...durations);

    return [
      { label: 'Average', value: UI.formatDuration(avg) },
      { label: 'Best Night', value: UI.formatDuration(best) },
      { label: 'Worst Night', value: UI.formatDuration(worst) },
      { label: 'Total Logs', value: completed.length }
    ];
  },

  _calcWeightStats(events) {
    if (events.length === 0) return [];
    const current = events[0].weight_kg;
    const first = events[events.length - 1].weight_kg;
    const lost = Math.round((first - current) * 10) / 10;
    const weekEvents = events.filter(e => new Date(e.timestamp) >= new Date(Date.now() - 7 * 86400000));
    const weekAvg = weekEvents.length > 0
      ? Math.round(weekEvents.reduce((s, e) => s + e.weight_kg, 0) / weekEvents.length * 10) / 10
      : current;

    return [
      { label: 'Current', value: current, unit: 'kg' },
      { label: 'Starting', value: first, unit: 'kg' },
      { label: 'Total Change', value: (lost >= 0 ? '-' : '+') + Math.abs(lost), unit: 'kg' },
      { label: 'Week Avg', value: weekAvg, unit: 'kg' }
    ];
  },

  _calcActivityStats(walks, steps) {
    const todayWalk = walks.find(w => w.timestamp && UI.localDateKey(w.timestamp) === UI.todayStr());
    const todaySteps = steps.find(s => s.date === UI.todayStr());
    const completedWalks = walks.filter(w => w.endTime);
    const avgWalkDuration = completedWalks.length > 0
      ? Math.round(completedWalks.reduce((s, w) => s + (w.duration_min || 0), 0) / completedWalks.length)
      : 0;
    const avgSteps = steps.length > 0
      ? Math.round(steps.reduce((s, e) => s + (e.steps || 0), 0) / steps.length)
      : 0;

    return [
      { label: "Today's Walk", value: todayWalk ? UI.formatDuration(todayWalk.duration_min) : 'None' },
      { label: "Today's Steps", value: todaySteps ? todaySteps.steps.toLocaleString() : 'None' },
      { label: 'Avg Walk', value: UI.formatDuration(avgWalkDuration) },
      { label: 'Avg Steps', value: avgSteps.toLocaleString() }
    ];
  },

  async _calcFoodStats() {
    const totals = await DataSource.getDailyFoodTotals(UI.todayStr());
    return [
      { label: 'Calories Today', value: Math.round(totals.calories || 0), unit: 'kcal' },
      { label: 'Protein Today', value: Math.round(totals.protein_g), unit: 'g' },
      { label: 'Carbs Today', value: Math.round(totals.carbs_g), unit: 'g' },
      { label: 'Fat Today', value: Math.round(totals.fat_g), unit: 'g' },
      { label: 'Sodium Today', value: Math.round(totals.sodium_mg), unit: 'mg' }
    ];
  },

  async _calcDrinkStats() {
    const todayTotal = await DataSource.getDailyDrinkTotal(UI.todayStr());
    return [
      { label: 'Today', value: todayTotal.toLocaleString(), unit: 'mL' },
      { label: 'Goal', value: (await DB.getSetting('fluidGoal')) || '—', unit: 'mL' }
    ];
  },

  _calcMedStats(meds) {
    const taken = meds.filter(m => m.status === 'Taken').length;
    const total = meds.length;
    const pct = total > 0 ? Math.round((taken / total) * 100) : 0;
    const thisWeek = meds.filter(m => new Date(m.timestamp) >= new Date(Date.now() - 7 * 86400000));
    const weekTaken = thisWeek.filter(m => m.status === 'Taken').length;
    const weekPct = thisWeek.length > 0 ? Math.round((weekTaken / thisWeek.length) * 100) : 0;

    return [
      { label: 'Overall Adherence', value: pct, unit: '%' },
      { label: 'Week Adherence', value: weekPct, unit: '%' },
      { label: 'Total Taken', value: taken },
      { label: 'Total Skipped', value: total - taken }
    ];
  }
};

/* ---------- Startup ---------- */
document.addEventListener('DOMContentLoaded', () => App.init());
