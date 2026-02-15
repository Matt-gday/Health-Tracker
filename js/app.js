/* ============================================
   Heart & Health Tracker — Main Application
   Navigation, state, event handling
   ============================================ */

const App = {
  APP_VERSION: '2.2.0',
  currentTab: 'home',
  previousPages: [],
  historyFilters: ['all'],
  _fullscreenSaveHandler: null,
  _editingEventId: null,

  /* ---------- Initialization ---------- */
  async init() {
    try {
      await DB.init();
      const needsSetupChoice = await DB.getSetting('needsSetupChoice');
      const hasProfile = await DB.getSetting('profileComplete');
      const events = await DB.getAllEvents(null, 1);
      const userName = await DB.getSetting('userName');
      const dbIsEmpty = !hasProfile && events.length === 0 && !userName;
      if (!needsSetupChoice && !dbIsEmpty) await DB.seedDefaults();
      await this.loadToggleStates();
      await this.renderCurrentTab();
      this.setupToggleGroupListeners();
      this._setupSwipeToDelete();
      this._autoCheckForUpdates();
      await this._checkFirstLaunch();
      await this.checkMedicationReminders();
      console.log('Heart Tracker v' + this.APP_VERSION + ' initialized');
    } catch (err) {
      console.error('Init failed:', err);
      UI.showToast('Failed to initialize app', 'error');
    }
  },

  async _checkFirstLaunch() {
    const hasProfile = await DB.getSetting('profileComplete');
    const events = await DB.getAllEvents(null, 1);
    const userName = await DB.getSetting('userName');
    const needsSetupChoice = await DB.getSetting('needsSetupChoice');

    // After delete-all or empty DB: show restore vs new profile choice first
    if (needsSetupChoice || (!hasProfile && events.length === 0 && !userName)) {
      this._showSetupChoice();
      return;
    }

    if (hasProfile) return;

    // Existing user who already has data, skip welcome
    if (events.length > 0 && userName) {
      await DB.setSetting('profileComplete', true);
      return;
    }

    this._showWelcomePopup();
  },

  _showWelcomePopup() {
    const body = `
      <p class="welcome-intro">Set up your profile. Change anytime in Settings → Personal Information.</p>
      <div class="form-group">
        <label>Name</label>
        <input type="text" class="form-input" id="welcome-name" placeholder="Your name">
      </div>
      <div class="form-group">
        <label class="label-with-hint">Date of Birth <span class="field-hint" onclick="event.stopPropagation();UI.showFieldHint('Used for age-based health insights and reporting')">?</span></label>
        <input type="date" class="form-input" id="welcome-dob">
      </div>
      <div class="form-group">
        <label class="label-with-hint">Gender <span class="field-hint" onclick="event.stopPropagation();UI.showFieldHint('Used for health calculations — some risk factors and norms differ by sex')">?</span></label>
        <select class="form-input" id="welcome-gender">
          <option value="">—</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>
      <div class="form-group">
        <label class="label-with-hint">Height (cm) <span class="field-hint" onclick="event.stopPropagation();UI.showFieldHint('Used for BMI and body composition calculations')">?</span></label>
        <input type="number" class="form-input" id="welcome-height" placeholder="e.g., 175" inputmode="numeric">
      </div>
      <div class="form-group">
        <label class="label-with-hint">Goal Weight (kg) <span class="field-hint" onclick="event.stopPropagation();UI.showFieldHint('Used to calculate your daily protein target and track progress')">?</span></label>
        <input type="number" step="0.1" class="form-input" id="welcome-goal-weight" placeholder="e.g., 80" inputmode="decimal">
      </div>
      <div class="form-group">
        <label class="label-with-hint">Do you drink alcohol? <span class="field-hint" onclick="event.stopPropagation();UI.showFieldHint('Alcohol can affect heart rhythm — we track it in AFib insights')">?</span></label>
        <select class="form-input" id="welcome-drinks-alcohol">
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </div>`;
    const footer = `<button class="btn btn-primary" onclick="App.saveWelcomeProfile()">Get Started</button>`;
    UI.openModal('Welcome to Heart & Health Tracker', body, footer, true);
  },

  async saveWelcomeProfile() {
    const name = document.getElementById('welcome-name').value.trim();
    const dob = document.getElementById('welcome-dob').value;
    const gender = document.getElementById('welcome-gender').value;
    const height = parseInt(document.getElementById('welcome-height').value) || null;
    const goalWeight = parseFloat(document.getElementById('welcome-goal-weight').value) || null;
    const drinksAlcohol = document.getElementById('welcome-drinks-alcohol')?.value || 'no';

    if (!name) {
      UI.showToast('Please enter your name', 'error');
      return;
    }
    if (!dob) {
      UI.showToast('Please enter your date of birth', 'error');
      return;
    }
    if (!gender) {
      UI.showToast('Please select your gender', 'error');
      return;
    }
    if (!height || height <= 0) {
      UI.showToast('Please enter your height (cm)', 'error');
      return;
    }
    if (!goalWeight || goalWeight <= 0) {
      UI.showToast('Please enter your goal weight (kg)', 'error');
      return;
    }

    if (name) await DB.setSetting('userName', name);
    if (dob) await DB.setSetting('userDOB', dob);
    if (gender) await DB.setSetting('userGender', gender);
    if (height) await DB.setSetting('userHeight', height);
    if (goalWeight) await DB.setSetting('goalWeight', goalWeight);
    await DB.setSetting('drinksAlcohol', drinksAlcohol);
    await DB.setSetting('profileComplete', true);

    UI.closeModal();
    UI.showToast(`Welcome${name ? ', ' + name : ''}! 🎉`, 'success');
    setTimeout(() => this.openSettingsPage('medications'), 400);
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
                   tab === 'afib-insights' ? 'page-afib-insights' :
                   tab === 'history' ? 'page-history' :
                   tab === 'settings' ? 'page-settings' : 'page-home';
    const page = document.getElementById(pageId);
    page.classList.add('active');
    page.scrollTop = 0;

    this.renderCurrentTab();
  },

  async renderCurrentTab() {
    // If we're on a detail page, refresh it
    if (this._currentDetailType && document.getElementById('page-detail').classList.contains('active')) {
      await this.openDetail(this._currentDetailType, true);
      return;
    }
    switch (this.currentTab) {
      case 'home':
        const dailySummary = await this._getDailySummary();
        UI.renderHome(this.toggleStates, dailySummary);
        break;
      case 'afib-insights':
        await this.renderAfibInsights();
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
    summary.drinksAlcohol = (await DB.getSetting('drinksAlcohol')) === 'yes';
    summary.userHeight = await DB.getSetting('userHeight');

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
  _currentDetailType: null,

  /* Week navigator state */
  _weekOffset: 0,
  _monthOffset: 0, // for monthly comparison navigator
  _bpContext: 'morning', // which BP context to show on chart: morning | post-walk | evening
  _cachedWalkEvents: null, // walk events cached for BP context classification
  _weekNavTypes: ['afib', 'bp_hr', 'sleep', 'activity', 'nutrition', 'medication', 'ventolin'],
  _monthNavTypes: ['afib', 'ventolin'], // types that get monthly comparison
  _cachedEvents: null, // store events for week nav re-renders

  _getWeekRange(offset = 0) {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (offset * 7));
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const fmt = d => `${d.getDate()} ${d.toLocaleString('en-AU', { month: 'short' })}`;
    return { start, end, label: `${fmt(start)} – ${fmt(end)}` };
  },

  _getMonthRange(offset = 0) {
    const now = new Date();
    // offset=0 → this calendar month, offset=1 → last calendar month
    const year = now.getFullYear();
    const month = now.getMonth() - offset;
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999); // last day of month
    const label = start.toLocaleString('en-AU', { month: 'long', year: 'numeric' });
    return { start, end, label };
  },

  _eventsInMonth(events, monthRange) {
    return events.filter(e => {
      const d = new Date(e.timestamp);
      return d >= monthRange.start && d <= monthRange.end;
    });
  },

  _eventsInWeek(events, weekRange, useLocalDate = true) {
    return events.filter(e => {
      const d = new Date(e.timestamp);
      return d >= weekRange.start && d <= weekRange.end;
    });
  },

  async openDetail(type, _isRefresh = false) {
    // Redirect individual types to combined pages
    if (type === 'walk' || type === 'steps') type = 'activity';
    if (type === 'food' || type === 'drink') type = 'nutrition';
    this._currentDetailType = type;
    if (!_isRefresh) {
      this.previousPages.push(this.currentTab);
      Charts._hiddenDatasets = []; // reset toggle state on fresh open
      this._weekOffset = 0; // reset week nav on fresh open
      this._monthOffset = 0; // reset month nav on fresh open
      this._bpContext = 'morning'; // reset BP context on fresh open
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const detailPage = document.getElementById('page-detail');
    detailPage.classList.add('active');
    detailPage.scrollTop = 0;
    document.getElementById('detail-content').scrollTop = 0;
    document.getElementById('tab-bar').style.display = 'none';

    const drinksAlcohol = (await DB.getSetting('drinksAlcohol')) === 'yes';
    let events, stats;
    switch (type) {
      case 'afib':
        events = await DataSource.getAllEvents('afib', 500);
        stats = this._calcAfibStats(events);
        break;
      case 'bp_hr': {
        events = await DataSource.getAllEvents('bp_hr', 500);
        const bpWalks = await DataSource.getAllEvents('walk', 500);
        this._cachedWalkEvents = bpWalks;
        stats = this._calcBpStats(events, bpWalks);
        break;
      }
      case 'sleep':
        events = await DataSource.getAllEvents('sleep', 500);
        stats = this._calcSleepStats(events);
        break;
      case 'weight':
        events = await DataSource.getAllEvents('weight', 500);
        stats = await this._calcWeightStats(events);
        break;
      case 'activity': {
        const walks = await DataSource.getAllEvents('walk', 500);
        const steps = await DataSource.getAllEvents('steps', 500);
        events = [...walks, ...steps].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        stats = this._calcActivityStats(walks, steps);
        break;
      }
      case 'nutrition': {
        const foodEvents = await DataSource.getAllEvents('food', 500);
        const drinkEvents = await DataSource.getAllEvents('drink', 500);
        events = [...foodEvents, ...drinkEvents].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        stats = await this._calcNutritionStats(events, drinksAlcohol);
        break;
      }
      case 'medication': {
        const meds = await DataSource.getAllEvents('medication', 500);
        events = meds.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        stats = this._calcMedStats(meds);
        break;
      }
      case 'ventolin': {
        events = await DataSource.getAllEvents('ventolin', 500);
        events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        stats = this._calcVentolinStats(events);
        break;
      }
      default:
        events = [];
        stats = [];
    }

    this._cachedEvents = events;
    UI.renderDetailPage(type, stats, events, this._weekNavTypes.includes(type) ? this._getWeekRange(this._weekOffset) : null, this._weekOffset, drinksAlcohol);
    Charts.renderDetail(type, events, drinksAlcohol);
  },

  goBack() {
    this._currentDetailType = null;
    this._weekOffset = 0; // reset week nav
    this._monthOffset = 0; // reset month nav
    this._bpContext = 'morning'; // reset BP context
    Charts._hiddenDatasets = []; // reset toggle state on page close
    document.getElementById('tab-bar').style.display = 'flex';
    const prev = this.previousPages.pop() || 'home';
    this.switchTab(prev);
  },

  /* ---------- Week Navigator ---------- */
  async shiftWeek(direction) {
    this._weekOffset = Math.max(0, this._weekOffset + direction);
    await this._refreshWeekStats();
  },

  /* ---------- Month Navigator ---------- */
  shiftMonth(direction) {
    this._monthOffset = Math.max(0, this._monthOffset + direction);
    this._refreshMonthlySummary();
  },

  _refreshMonthlySummary() {
    const type = this._currentDetailType;
    if (!type || !this._monthNavTypes.includes(type)) return;
    const events = this._cachedEvents || [];
    let stats;
    switch (type) {
      case 'afib': stats = this._calcAfibStats(events); break;
      case 'ventolin': stats = this._calcVentolinStats(events); break;
      default: return;
    }
    if (stats._monthlySummary) {
      const el = document.getElementById('monthly-summary');
      if (el) {
        el.outerHTML = UI._buildMonthlySummaryHtml(stats._monthlySummary);
      }
    }
  },

  async _refreshWeekStats() {
    const type = this._currentDetailType;
    if (!type || !this._weekNavTypes.includes(type)) return;
    const events = this._cachedEvents || [];
    const weekRange = this._getWeekRange(this._weekOffset);
    let stats;
    switch (type) {
      case 'afib': stats = this._calcAfibStats(events); break;
      case 'bp_hr': stats = this._calcBpStats(events, this._cachedWalkEvents); break;
      case 'sleep': stats = this._calcSleepStats(events); break;
      case 'activity': {
        const walks = events.filter(e => e.eventType === 'walk');
        const steps = events.filter(e => e.eventType === 'steps');
        stats = this._calcActivityStats(walks, steps);
        break;
      }
      case 'nutrition': stats = await this._calcNutritionStats(events, (await DB.getSetting('drinksAlcohol')) === 'yes'); break;
      case 'medication': {
        const meds = events.filter(e => e.eventType === 'medication');
        stats = this._calcMedStats(meds);
        break;
      }
      case 'ventolin': stats = this._calcVentolinStats(events); break;
      default: stats = [];
    }
    // Re-render only the stats section and week nav
    UI.updateWeekStats(stats, weekRange, this._weekOffset);
  },

  /* ---------- Chart Range Filter (all types) ---------- */
  async setChartRange(type, range) {
    Charts._chartRanges[type] = range;

    // Re-fetch events and re-render chart only
    let events;
    switch (type) {
      case 'afib': events = await DataSource.getAllEvents('afib', 500); break;
      case 'bp_hr': {
        events = await DataSource.getAllEvents('bp_hr', 500);
        if (!this._cachedWalkEvents) {
          this._cachedWalkEvents = await DataSource.getAllEvents('walk', 500);
        }
        break;
      }
      case 'sleep': events = await DataSource.getAllEvents('sleep', 500); break;
      case 'weight': events = await DataSource.getAllEvents('weight', 500); break;
      case 'activity': {
        const w = await DataSource.getAllEvents('walk', 500);
        const s = await DataSource.getAllEvents('steps', 500);
        events = [...w, ...s].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        break;
      }
      case 'food': events = await DataSource.getAllEvents('food', 500); break;
      case 'drink': events = await DataSource.getAllEvents('drink', 500); break;
      case 'nutrition': {
        const f = await DataSource.getAllEvents('food', 500);
        const d = await DataSource.getAllEvents('drink', 500);
        events = [...f, ...d].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        break;
      }
      case 'medication': {
        const m = await DataSource.getAllEvents('medication', 500);
        events = m.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        break;
      }
      case 'ventolin': events = await DataSource.getAllEvents('ventolin', 500); break;
      default: events = []; break;
    }
    const drinksAlcohol = (await DB.getSetting('drinksAlcohol')) === 'yes';
    Charts.renderDetail(type, events, drinksAlcohol);

    // Update active button
    const labelMap = { 'week': '7 Days', 'month': '30 Days', '3month': '3 Months', 'all': 'All Time' };
    document.querySelectorAll('.chart-range-filters .filter-chip').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim() === labelMap[range]);
    });
  },

  

  /* ---------- Add from Detail Page ---------- */
  addFromDetail() {
    const type = this._currentDetailType;
    switch (type) {
      case 'bp_hr': this.openBpEntry(); break;
      case 'weight': this.openWeightEntry(); break;
      case 'food': this.openFoodEntry(); break;
      case 'drink': this.openDrinkEntry(); break;
      case 'nutrition': this.openNutritionAddPicker(); break;
      case 'medication': this.openRetrospectiveMedEntry(); break;
      case 'activity': this.openManualActivityEntry(); break;
      case 'afib': this.openManualAfibEntry(); break;
      case 'sleep': this.openManualSleepEntry(); break;
      case 'ventolin': this.openVentolinAddEntry(); break;
      default:
        UI.showToast('Add not available for this type', 'info');
    }
  },

  /* Manual entry for toggle-based types from detail view */
  openManualAfibEntry() {
    this._editingEventId = null;
    const now = UI.localISOString(new Date());
    const onsetOptions = ['Resting', 'Sleeping', 'Eating', 'Exercising', 'Stressed', 'Bending Over', 'Just Woke Up', 'Other'];
    const body = `
      <div class="form-group">
        <label>AFib Episode — Start Time</label>
        <input type="datetime-local" class="form-input" id="toggle-start" value="${now}">
      </div>
      <div class="form-group">
        <label>End Time</label>
        <input type="datetime-local" class="form-input" id="toggle-end" value="">
      </div>
      <div class="form-group">
        <label>What were you doing?</label>
        <div class="onset-ctx-grid">
          ${onsetOptions.map(opt => `<label class="onset-ctx-option"><input type="checkbox" value="${opt}"><span>${opt}</span></label>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-input" id="toggle-notes" placeholder="Optional notes..."></textarea>
      </div>`;
    const footer = `<button class="btn btn-primary" onclick="App.saveManualToggleEntry('afib')">Save</button>`;
    UI.openModal('Log AFib Episode', body, footer);
  },

  openManualSleepEntry() {
    this._editingEventId = null;
    const now = UI.localISOString(new Date());
    const body = `
      <div class="form-group">
        <label>Sleep — Start Time</label>
        <input type="datetime-local" class="form-input" id="toggle-start" value="${now}">
      </div>
      <div class="form-group">
        <label>End Time</label>
        <input type="datetime-local" class="form-input" id="toggle-end" value="">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-input" id="toggle-notes" placeholder="Optional notes..."></textarea>
      </div>`;
    const footer = `<button class="btn btn-primary" onclick="App.saveManualToggleEntry('sleep')">Save</button>`;
    UI.openModal('Log Sleep', body, footer);
  },

  openVentolinAddEntry() {
    const now = UI.localISOString(new Date());
    const body = `
      <div class="form-group">
        <label>Reason</label>
        <div class="toggle-group" id="ventolin-add-ctx">
          <button class="toggle-option active" data-value="Preventive">Pre-Exercise</button>
          <button class="toggle-option" data-value="Reactive">Symptom Relief</button>
        </div>
      </div>
      <div class="form-group">
        <label>Date & Time</label>
        <input type="datetime-local" class="form-input" id="ventolin-add-timestamp" value="${now}">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-input" id="ventolin-add-notes" placeholder="Optional notes..."></textarea>
      </div>`;
    const footer = `<button class="btn btn-primary" onclick="App.saveVentolinAddEntry()">Save</button>`;
    UI.openModal('Log Ventolin Use', body, footer);
    // Wire up toggle buttons
    setTimeout(() => {
      document.querySelectorAll('#ventolin-add-ctx .toggle-option').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#ventolin-add-ctx .toggle-option').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });
    }, 50);
  },

  async saveVentolinAddEntry() {
    const context = this._getToggleValue('ventolin-add-ctx') || 'Reactive';
    const ts = document.getElementById('ventolin-add-timestamp').value;
    const notes = document.getElementById('ventolin-add-notes').value.trim();
    if (!ts) { UI.showToast('Please set a date & time', 'error'); return; }

    await DB.addEvent({
      eventType: 'ventolin',
      context,
      timestamp: new Date(ts).toISOString(),
      notes: notes || undefined
    });
    UI.closeModal();
    UI.showToast(`Ventolin (${context === 'Preventive' ? 'Pre-Exercise' : 'Symptom Relief'}) logged`, 'success');
    if (this._currentDetailType === 'ventolin') {
      await this.openDetail('ventolin', true);
    }
  },

  openNutritionAddPicker() {
    const body = `
      <p style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">What would you like to log?</p>
      <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
        <button class="btn btn-secondary" onclick="UI.closeModal();App.openFoodEntry()">
          <i data-lucide="utensils"></i> Food
        </button>
        <button class="btn btn-secondary" onclick="UI.closeModal();App.openDrinkEntry()">
          <i data-lucide="droplets"></i> Drink
        </button>
      </div>`;
    UI.openModal('Add Nutrition Entry', body, '');
  },

  openManualActivityEntry() {
    this._editingEventId = null;
    const body = `
      <p style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">Choose what to log:</p>
      <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
        <button class="btn btn-secondary" onclick="UI.closeModal();App.openManualWalkEntry()">
          <i data-lucide="footprints"></i> Walk
        </button>
        <button class="btn btn-secondary" onclick="UI.closeModal();App.openStepsEntry()">
          <i data-lucide="trending-up"></i> Steps
        </button>
      </div>`;
    UI.openModal('Add Activity', body, '');
  },

  openManualWalkEntry() {
    this._editingEventId = null;
    const now = UI.localISOString(new Date());
    const body = `
      <div class="form-group">
        <label>Walk — Start Time</label>
        <input type="datetime-local" class="form-input" id="toggle-start" value="${now}">
      </div>
      <div class="form-group">
        <label>End Time</label>
        <input type="datetime-local" class="form-input" id="toggle-end" value="">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-input" id="toggle-notes" placeholder="Optional notes..."></textarea>
      </div>`;
    const footer = `<button class="btn btn-primary" onclick="App.saveManualToggleEntry('walk')">Save</button>`;
    UI.openModal('Log Walk', body, footer);
  },

  async saveManualToggleEntry(eventType) {
    const startVal = document.getElementById('toggle-start').value;
    const endVal = document.getElementById('toggle-end').value;
    if (!startVal) {
      UI.showToast('Start time is required', 'error');
      return;
    }
    const startTime = new Date(startVal).toISOString();
    const endTime = endVal ? new Date(endVal).toISOString() : null;
    let duration_min = null;
    if (startTime && endTime) {
      duration_min = Math.round((new Date(endTime) - new Date(startTime)) / 60000);
      if (duration_min < 0) {
        UI.showToast('End time must be after start time', 'error');
        return;
      }
    }
    const data = {
      eventType,
      startTime,
      endTime,
      timestamp: startTime,
      duration_min,
      notes: document.getElementById('toggle-notes').value.trim()
    };
    if (eventType === 'afib') {
      data.isDuringAFib = true;
      data.onsetContext = [...document.querySelectorAll('.onset-ctx-option input:checked')].map(cb => cb.value);
    }
    await DB.addEvent(data);
    UI.closeModal();
    UI.showToast(`${eventType === 'afib' ? 'AFib episode' : eventType.charAt(0).toUpperCase() + eventType.slice(1)} logged`, 'success');
    await this.openDetail(this._currentDetailType, true);
  },

  /* Retrospective medication entry — all meds, custom date/time */
  async openRetrospectiveMedEntry() {
    const allMeds = await DB.getMedications();
    if (!allMeds || allMeds.length === 0) {
      UI.showToast('No medications configured. Add them in Settings.', 'info');
      return;
    }
    const now = UI.localISOString(new Date());
    const body = UI.buildRetrospectiveMedForm(allMeds, now);
    const footer = `<button class="btn btn-primary" onclick="App.saveRetrospectiveMedEntry()">Save Selected</button>`;
    UI.openModal('Log Medications', body, footer);
    this.setupToggleGroupListeners();
  },

  async saveRetrospectiveMedEntry() {
    const timestampVal = document.getElementById('retro-med-timestamp').value;
    if (!timestampVal) {
      UI.showToast('Date & time is required', 'error');
      return;
    }
    const timestamp = new Date(timestampVal).toISOString();
    const hour = new Date(timestampVal).getHours();
    const timeOfDay = hour < 12 ? 'AM' : 'PM';

    const checkboxes = document.querySelectorAll('.retro-med-checkbox');
    let count = 0;
    for (const cb of checkboxes) {
      if (!cb.classList.contains('checked')) continue;
      const medId = cb.dataset.medId;
      const med = await DB.getMedication(medId);
      if (!med) continue;

      const status = cb.dataset.status || 'Taken';
      await DB.addEvent({
        eventType: 'medication',
        medName: med.name,
        dosage: med.dosage,
        status,
        timeOfDay,
        timestamp
      });
      count++;
    }

    if (count === 0) {
      UI.showToast('No medications selected', 'info');
      return;
    }

    UI.closeModal();
    UI.showToast(`${count} medication${count > 1 ? 's' : ''} logged`, 'success');
    await this.openDetail('medication', true);
  },

  toggleRetroMedCheck(index) {
    const el = document.getElementById(`retro-med-${index}`);
    if (el.classList.contains('checked')) {
      // Checked → Skipped
      if (el.dataset.status === 'Taken') {
        el.dataset.status = 'Skipped';
        el.classList.add('skipped');
        el.innerHTML = '<i data-lucide="x"></i>';
      } else {
        // Skipped → Unchecked
        el.classList.remove('checked', 'skipped');
        el.dataset.status = '';
        el.innerHTML = '';
      }
    } else {
      // Unchecked → Taken
      el.classList.add('checked');
      el.classList.remove('skipped');
      el.dataset.status = 'Taken';
      el.innerHTML = '<i data-lucide="check"></i>';
    }
    lucide.createIcons();
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
        isDuringAFib: true,
        onsetContext: toggle.onsetContext || [],
        onsetNotes: toggle.onsetNotes || ''
      });

      await DB.clearActiveToggle('afib');
      this.toggleStates.afib = null;
      UI.showToast(`AFib episode ended — ${UI.formatDuration(duration_min)}`, 'info');
      const summary1 = await this._getDailySummary();
      UI.renderHome(this.toggleStates, summary1);
    } else {
      // Start AFib — show onset context popup first
      const onsetOptions = ['Resting', 'Sleeping', 'Eating', 'Exercising', 'Stressed', 'Bending Over', 'Just Woke Up', 'Other'];
      const body = `
        <p style="color:var(--text-secondary);margin-bottom:var(--space-sm);font-size:var(--font-sm)">What were you doing when it started?</p>
        <div class="onset-ctx-grid">
          ${onsetOptions.map(opt => `<label class="onset-ctx-option"><input type="checkbox" value="${opt}"><span>${opt}</span></label>`).join('')}
        </div>
        <div class="form-group" style="margin-top:var(--space-sm)">
          <label>Notes (optional)</label>
          <textarea class="form-input" id="afib-onset-notes" placeholder="Any other details..."></textarea>
        </div>`;
      const footer = `<button class="btn btn-primary" onclick="App._confirmAfibStart()">Start Tracking</button>`;
      UI.openModal('AFib Episode', body, footer);
    }
  },

  async openSymptomLog() {
    const symptomOptions = ['Palpitations', 'Racing Heart', 'Dizziness', 'Chest Tightness', 'Shortness of Breath', 'Fatigue', 'Lightheaded', 'Nausea', 'Sweating', 'Anxiety'];
    const body = `
      <p style="color:var(--text-secondary);margin-bottom:var(--space-sm);font-size:var(--font-sm)">What symptoms are you experiencing?</p>
      <div class="onset-ctx-grid">
        ${symptomOptions.map(opt => `<label class="onset-ctx-option"><input type="checkbox" value="${opt}"><span>${opt}</span></label>`).join('')}
      </div>
      <div class="form-group" style="margin-top:var(--space-sm)">
        <label>Notes (optional)</label>
        <textarea class="form-input" id="symptom-notes" placeholder="Any other details..."></textarea>
      </div>`;
    const footer = `<button class="btn btn-primary" onclick="App._saveSymptomLog()">Save Symptoms</button>`;
    UI.openModal('Log Symptoms', body, footer);
  },

  async _saveSymptomLog() {
    const checked = [...document.querySelectorAll('.onset-ctx-option input:checked')].map(cb => cb.value);
    const notes = (document.getElementById('symptom-notes')?.value || '').trim();
    if (checked.length === 0 && !notes) {
      UI.showToast('Select at least one symptom', 'error');
      return;
    }
    const toggle = this.toggleStates.afib;
    await DB.addEvent({
      eventType: 'afib_symptom',
      symptoms: checked,
      notes,
      timestamp: new Date().toISOString(),
      afibStartTime: toggle ? toggle.startTime : null
    });
    UI.closeModal();
    UI.showToast('Symptoms logged', 'success');
  },

  async _confirmAfibStart() {
    const checked = [...document.querySelectorAll('.onset-ctx-option input:checked')].map(cb => cb.value);
    const notes = (document.getElementById('afib-onset-notes')?.value || '').trim();
    const startTime = new Date().toISOString();
    await DB.setActiveToggle('afib', { startTime, onsetContext: checked, onsetNotes: notes });
    this.toggleStates.afib = { type: 'afib', startTime, onsetContext: checked, onsetNotes: notes };
    UI.closeModal();
    UI.showToast('AFib episode started', 'warning');
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
      timestamp: new Date(document.getElementById('bp-timestamp').value).toISOString(),
      notes: document.getElementById('bp-notes').value.trim()
    };
    // exerciseContext and foodContext are now computed dynamically — no longer stored

    if (!data.systolic && !data.diastolic && !data.heartRate) {
      UI.showToast('Please enter at least one value', 'error');
      return;
    }

    // medContext is now calculated dynamically — no longer stored

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

  /**
   * Computes med context dynamically from a list of medication events.
   * Returns { label: 'Post-Meds (45m)', context: 'Post-Meds', minsSinceMeds: 45 }
   * or { label: 'Pre-Meds', context: 'Pre-Meds', minsSinceMeds: null }
   * or null if no meds that day.
   * Can be called with a pre-filtered medEvents array (sync) or will fetch if not provided (async).
   */
  computeMedContext(bpTimestampISO, dayMedEvents) {
    const dateKey = UI.localDateKey(bpTimestampISO);
    const todayMeds = (dayMedEvents || []).filter(m =>
      UI.localDateKey(m.timestamp) === dateKey && m.status === 'Taken'
    );
    if (todayMeds.length === 0) return null;

    const bpTime = new Date(bpTimestampISO).getTime();
    const medsBefore = todayMeds
      .filter(m => new Date(m.timestamp).getTime() <= bpTime)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (medsBefore.length > 0) {
      const lastMedTime = new Date(medsBefore[0].timestamp).getTime();
      const minsSince = Math.round((bpTime - lastMedTime) / 60000);
      const timeStr = minsSince < 60 ? `${minsSince}m` : `${Math.floor(minsSince / 60)}h ${minsSince % 60}m`;
      return { label: `Post-Meds (${timeStr})`, context: 'Post-Meds', minsSinceMeds: minsSince };
    } else {
      return { label: 'Pre-Meds', context: 'Pre-Meds', minsSinceMeds: null };
    }
  },

  /**
   * Classify a BP reading into morning / post-walk / evening.
   * Post-Walk: within 90 min after any walk's endTime that day.
   * Morning: before 2pm and not post-walk.
   * Evening: 2pm or later and not post-walk.
   */
  classifyBpReading(bpEvent, allWalkEvents) {
    const bpTime = new Date(bpEvent.timestamp).getTime();
    const bpDate = UI.localDateKey(bpEvent.timestamp);
    const bpHour = new Date(bpEvent.timestamp).getHours();

    const dayWalks = (allWalkEvents || []).filter(w =>
      w.endTime && UI.localDateKey(w.endTime) === bpDate
    );

    for (const walk of dayWalks) {
      const walkEnd = new Date(walk.endTime).getTime();
      const minsSince = (bpTime - walkEnd) / 60000;
      if (minsSince >= 0 && minsSince <= 90) {
        return 'post-walk';
      }
    }

    if (bpHour < 14) return 'morning';
    return 'evening';
  },

  /**
   * Compute walk context for a BP reading (for display & export).
   * Returns { label, context, minsSinceWalk } or null.
   */
  computeWalkContext(bpTimestampISO, dayWalkEvents) {
    const bpDate = UI.localDateKey(bpTimestampISO);
    const bpTime = new Date(bpTimestampISO).getTime();
    const dayWalks = (dayWalkEvents || []).filter(w =>
      w.endTime && UI.localDateKey(w.endTime) === bpDate
    );

    for (const walk of dayWalks) {
      const walkEnd = new Date(walk.endTime).getTime();
      const minsSince = Math.round((bpTime - walkEnd) / 60000);
      if (minsSince >= 0 && minsSince <= 90) {
        const timeStr = minsSince < 60 ? `${minsSince}m` : `${Math.floor(minsSince / 60)}h ${minsSince % 60}m`;
        return { label: `Post-Walk (${timeStr})`, context: 'Post-Walk', minsSinceWalk: minsSince };
      }
    }
    return { label: 'Resting', context: 'Resting', minsSinceWalk: null };
  },

  /**
   * Compute food context for a BP reading (for display & export).
   */
  computeFoodContext(bpTimestampISO, dayFoodDrinkEvents) {
    const bpDate = UI.localDateKey(bpTimestampISO);
    const bpTime = new Date(bpTimestampISO).getTime();
    const dayFood = (dayFoodDrinkEvents || []).filter(e =>
      (e.eventType === 'food' || (e.eventType === 'drink' && (e.calories || 0) > 0)) &&
      UI.localDateKey(e.timestamp) === bpDate &&
      new Date(e.timestamp).getTime() <= bpTime
    ).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (dayFood.length > 0) {
      const lastTime = new Date(dayFood[0].timestamp).getTime();
      const minsSince = Math.round((bpTime - lastTime) / 60000);
      const timeStr = minsSince < 60 ? `${minsSince}m` : `${Math.floor(minsSince / 60)}h ${minsSince % 60}m`;
      return { label: `Post-Meal (${timeStr})`, context: 'Post-Meal', minsSinceMeal: minsSince };
    }
    return { label: 'Fasting', context: 'Fasting', minsSinceMeal: null };
  },

  /**
   * Compute caffeine context for a BP reading.
   */
  computeCaffeineContext(bpTimestampISO, dayDrinkEvents) {
    const bpDate = UI.localDateKey(bpTimestampISO);
    const bpTime = new Date(bpTimestampISO).getTime();
    const dayCaffeine = (dayDrinkEvents || []).filter(e =>
      e.eventType === 'drink' && (e.caffeine_mg || 0) > 0 &&
      UI.localDateKey(e.timestamp) === bpDate &&
      new Date(e.timestamp).getTime() <= bpTime
    ).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (dayCaffeine.length > 0) {
      const lastTime = new Date(dayCaffeine[0].timestamp).getTime();
      const minsSince = Math.round((bpTime - lastTime) / 60000);
      const timeStr = minsSince < 60 ? `${minsSince}m` : `${Math.floor(minsSince / 60)}h ${minsSince % 60}m`;
      return { label: `Post-Caffeine (${timeStr})`, context: 'Post-Caffeine', minsSinceCaffeine: minsSince };
    }
    return null;
  },

  /**
   * Switch BP chart context (morning / post-walk / evening) and re-render.
   */
  async setBpContext(context) {
    this._bpContext = context;
    const events = this._cachedEvents || await DataSource.getAllEvents('bp_hr', 500);
    if (!this._cachedWalkEvents) {
      this._cachedWalkEvents = await DataSource.getAllEvents('walk', 500);
    }
    Charts.renderDetail('bp_hr', events);
    // Update selector buttons
    document.querySelectorAll('.bp-context-filters button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ctx === context);
    });
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
  async openDrinkEntry(existingData = null) {
    this._editingEventId = existingData?.id || null;
    const drinksAlcohol = (await DB.getSetting('drinksAlcohol')) === 'yes';
    const title = existingData ? 'Edit Drink' : 'Log Drink';
    const body = UI.buildDrinkEntryForm(existingData, drinksAlcohol);
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
      alcohol_units: document.getElementById('drink-alcohol') ? parseFloat(document.getElementById('drink-alcohol').value) || 0 : 0,
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

  _selectedStress: null,

  selectStress(level) {
    if (this._selectedStress === level) {
      this._selectedStress = null;
      document.querySelectorAll('.stress-dot').forEach(d => d.classList.remove('active'));
    } else {
      this._selectedStress = level;
      document.querySelectorAll('.stress-dot').forEach(d => {
        d.classList.toggle('active', parseInt(d.dataset.level) === level);
      });
    }
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
    // Save stress level if selected
    if (this._selectedStress) {
      await DB.addEvent({
        eventType: 'stress',
        level: this._selectedStress,
        timestamp: new Date().toISOString()
      });
      this._selectedStress = null;
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
      case 'drink': await this.openDrinkEntry(event); break;
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
    const updateData = {
      startTime, endTime, duration_min,
      timestamp: startTime,
      notes: document.getElementById('toggle-notes').value.trim()
    };
    if (eventType === 'afib') {
      updateData.onsetContext = [...document.querySelectorAll('.onset-ctx-option input:checked')].map(cb => cb.value);
    }
    await DB.updateEvent(this._editingEventId, updateData);
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

  _setupSwipeToDelete() {
    let swipeStartX = 0;
    let swipeEl = null;

    const closeAll = () => {
      document.querySelectorAll('.swipeable-entry-slider').forEach(el => {
        el.style.transition = 'transform 0.2s ease-out';
        el.style.transform = 'translateX(0)';
      });
      swipeEl = null;
    };

    document.addEventListener('touchstart', (e) => {
      const entry = e.target.closest('.swipeable-entry');
      if (!entry) return;
      const slider = entry.querySelector('.swipeable-entry-slider');
      if (!slider) return;
      closeAll();
      swipeEl = slider;
      swipeStartX = e.touches[0].clientX;
      slider.style.transition = 'none';
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!swipeEl) return;
      const dx = e.touches[0].clientX - swipeStartX;
      const tx = Math.min(0, Math.max(-80, dx));
      swipeEl.style.transform = `translateX(${tx}px)`;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      if (!swipeEl) return;
      const currentTx = parseFloat(swipeEl.style.transform.replace('translateX(', '').replace('px)', '')) || 0;
      swipeEl.style.transition = 'transform 0.2s ease-out';
      swipeEl.style.transform = currentTx < -40 ? 'translateX(-80px)' : 'translateX(0)';
      swipeEl = null;
    }, { passive: true });

    document.addEventListener('click', (e) => {
      const entry = e.target.closest('.swipeable-entry');
      if (!entry) return;
      if (e.target.closest('.swipeable-delete')) return;
      const slider = entry.querySelector('.swipeable-entry-slider');
      const isOpen = slider && slider.style.transform && slider.style.transform.includes('-80px');
      if (isOpen) {
        slider.style.transition = 'transform 0.2s ease-out';
        slider.style.transform = 'translateX(0)';
        e.preventDefault();
        e.stopPropagation();
      } else {
        closeAll();
      }
    }, true);
  },

  async deleteEntryById(id) {
    if (typeof id === 'string' && id.startsWith('demo-')) {
      UI.showToast('Demo entry cannot be deleted', 'info');
      return;
    }
    const confirmed = await UI.confirm('Delete Entry', 'Are you sure you want to delete this entry? This cannot be undone.');
    if (!confirmed) return;
    await DB.deleteEvent(id);
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
    const drinksAlcohol = (await DB.getSetting('drinksAlcohol')) === 'yes';
    UI.renderHistory(events, this.historyFilters, drinksAlcohol);
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

  /* ---------- AFib Insights ---------- */
  async renderAfibInsights() {
    const content = document.getElementById('afib-insights-content');
    if (!content) return;
    content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-tertiary)">Loading insights...</div>';

    // Fetch all relevant data
    const [afibEvents, bpEvents, medEvents, sleepEvents, foodEvents, drinkEvents, walkEvents, stepEvents, weightEvents, stressEvents, symptomEvents, drinksAlcohol, medications] = await Promise.all([
      DataSource.getAllEvents('afib', 500),
      DataSource.getAllEvents('bp_hr', 500),
      DataSource.getAllEvents('medication', 1000),
      DataSource.getAllEvents('sleep', 500),
      DataSource.getAllEvents('food', 1000),
      DataSource.getAllEvents('drink', 1000),
      DataSource.getAllEvents('walk', 500),
      DataSource.getAllEvents('steps', 500),
      DataSource.getAllEvents('weight', 500),
      DataSource.getAllEvents('stress', 500),
      DataSource.getAllEvents('afib_symptom', 500),
      DB.getSetting('drinksAlcohol').then(v => v === 'yes'),
      Demo.isActive ? Promise.resolve(Demo.getMedications()) : DB.getMedications()
    ]);

    const completed = afibEvents.filter(e => e.endTime).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (completed.length === 0) {
      content.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-secondary)">
        <div style="font-size:48px;margin-bottom:16px">💚</div>
        <h3 style="margin-bottom:8px">No AFib Episodes Recorded</h3>
        <p style="font-size:var(--font-sm);color:var(--text-tertiary)">When you log AFib episodes, this page will show intelligent analysis of potential triggers and patterns.</p>
      </div>`;
      return;
    }

    const allFoodDrink = [...foodEvents, ...drinkEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    let html = '';

    // --- Section 1: Overview Stats ---
    const daysSinceLast = Math.floor((Date.now() - new Date(completed[0].startTime || completed[0].timestamp).getTime()) / 86400000);
    const last30 = completed.filter(e => (Date.now() - new Date(e.startTime || e.timestamp).getTime()) < 30 * 86400000);
    const prev30 = completed.filter(e => {
      const t = Date.now() - new Date(e.startTime || e.timestamp).getTime();
      return t >= 30 * 86400000 && t < 60 * 86400000;
    });
    const totalDur30 = last30.reduce((s, e) => s + (e.duration_min || 0), 0);
    const avgDur = last30.length > 0 ? Math.round(totalDur30 / last30.length) : 0;

    html += `<div class="section-title" style="padding:var(--space-sm) var(--space-md) 0">Overview</div>`;
    html += `<div class="stats-grid" style="padding:var(--space-sm) var(--space-md)">`;
    html += UI._buildStatCardHtml({ label: 'Days Since Last', value: daysSinceLast, unit: daysSinceLast === 1 ? 'day' : 'days', color: daysSinceLast > 14 ? '#10B981' : daysSinceLast > 7 ? '#F59E0B' : '#EF4444' });
    html += UI._buildStatCardHtml({ label: 'Last 30 Days', value: last30.length, unit: last30.length === 1 ? 'episode' : 'episodes', ...this._vsBadge(last30.length, prev30.length, true) });
    html += UI._buildStatCardHtml({ label: 'Avg Duration', value: UI.formatDuration(avgDur) });
    html += UI._buildStatCardHtml({ label: 'Total Episodes', value: completed.length });
    html += `</div>`;

    // --- Section 2: Recent Episodes with Context ---
    html += `<div class="section-title" style="padding:var(--space-sm) var(--space-md) 0">Recent Episodes</div>`;
    const recentEpisodes = completed.slice(0, 10);

    for (const ep of recentEpisodes) {
      const epStart = new Date(ep.startTime || ep.timestamp);
      const epDate = epStart.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
      const epTime = epStart.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
      const durMin = ep.duration_min || 0;
      const durStr = UI.formatDuration(durMin);
      const epDateKey = UI.localDateKey(ep.startTime || ep.timestamp);

      // Gather 24hr pre-episode context
      const lookbackMs = 24 * 60 * 60 * 1000;
      const epStartMs = epStart.getTime();
      const inWindow = (e, field) => {
        const t = new Date(e[field] || e.timestamp).getTime();
        return t < epStartMs && t > (epStartMs - lookbackMs);
      };

      // Meds: check day-of and day-before
      const prevDay = new Date(epStartMs - 86400000).toISOString().slice(0, 10);
      const dayMeds = medEvents.filter(e => UI.localDateKey(e.timestamp) === epDateKey || UI.localDateKey(e.timestamp) === prevDay);
      const missedMeds = dayMeds.filter(m => m.status === 'Skipped');
      const takenMeds = dayMeds.filter(m => m.status === 'Taken');

      // Caffeine in 12hrs before
      const caff12h = allFoodDrink.filter(e => {
        const t = new Date(e.timestamp).getTime();
        return t < epStartMs && t > (epStartMs - 12 * 3600000) && (e.caffeine_mg || 0) > 0;
      });
      const totalCaff = caff12h.reduce((s, e) => s + (e.caffeine_mg || 0), 0);

      // Sleep the night before
      const prevNightSleep = sleepEvents.find(e => {
        const wakeKey = e.endTime ? UI.localDateKey(e.endTime) : UI.localDateKey(e.timestamp);
        return wakeKey === epDateKey || wakeKey === prevDay;
      });
      const sleepHrs = prevNightSleep ? Math.round((prevNightSleep.duration_min || 0) / 60 * 10) / 10 : null;

      // BP readings before episode
      const preBp = bpEvents.filter(e => inWindow(e, 'timestamp')).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const lastBp = preBp[0];

      // Walk before episode — find the most recent completed walk
      const preWalk = walkEvents.filter(e => e.endTime && inWindow(e, 'timestamp'))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const lastWalk = preWalk[0];

      // Food in 4hrs before (large meal trigger)
      const preFood = foodEvents.filter(e => {
        const t = new Date(e.timestamp).getTime();
        return t < epStartMs && t > (epStartMs - 4 * 3600000);
      });
      const preFoodCal = preFood.reduce((s, e) => s + (e.calories || 0), 0);

      // Fluid in 24hrs before episode
      const dayFluid = drinkEvents.filter(e => {
        const t = new Date(e.timestamp).getTime();
        return t < epStartMs && t > (epStartMs - 24 * 3600000);
      }).reduce((s, e) => s + (e.volume_ml || 0), 0);

      // Build context items
      let ctx = '';

      // Meds context — show which specific doses were missed with AM/PM and timing; flag AFib-relevant meds
      let medDetail = '';
      const medLookup = (medications || []).reduce((acc, m) => { acc[m.name] = m; return acc; }, {});
      if (missedMeds.length > 0) {
        const afibMissed = missedMeds.filter(m => (medLookup[m.medName || m.name] || {}).afibRelevant);
        const afibLabel = afibMissed.length > 0 ? ` (${afibMissed.length} AFib med${afibMissed.length > 1 ? 's' : ''})` : '';
        ctx += `<div class="insight-ctx-item insight-ctx-warn"><span class="insight-ctx-icon">💊</span><span>${missedMeds.length} dose${missedMeds.length > 1 ? 's' : ''} missed${afibLabel}</span></div>`;
        const missedLines = missedMeds.map(m => {
          const period = m.timeOfDay === 'AM' ? 'AM' : 'PM';
          const dayLabel = UI.localDateKey(m.timestamp) === epDateKey ? 'same day' : 'day before';
          const afibTag = (medLookup[m.medName || m.name] || {}).afibRelevant ? ' <span class="insight-afib-med-tag">AFib</span>' : '';
          return `${period}: ${m.medName || m.name || 'Unknown'}${afibTag} (${dayLabel})`;
        });
        medDetail = `<div class="insight-med-detail">${missedLines.join('<br>')}</div>`;
      } else if (takenMeds.length > 0) {
        ctx += `<div class="insight-ctx-item insight-ctx-ok"><span class="insight-ctx-icon">💊</span><span>All meds taken</span></div>`;
      } else {
        ctx += `<div class="insight-ctx-item insight-ctx-neutral"><span class="insight-ctx-icon">💊</span><span>No med data</span></div>`;
      }

      // Magnesium/electrolyte awareness
      const mgPattern = /magnesium|mag\b|electrolyte|potassium/i;
      const mgMeds = dayMeds.filter(m => mgPattern.test(m.medName || m.name || ''));
      const mgTaken = mgMeds.filter(m => m.status === 'Taken');
      const mgMissed = mgMeds.filter(m => m.status === 'Skipped');
      if (mgMissed.length > 0) {
        ctx += `<div class="insight-ctx-item insight-ctx-warn"><span class="insight-ctx-icon">🧪</span><span>Magnesium/electrolyte missed</span></div>`;
      } else if (mgTaken.length > 0) {
        ctx += `<div class="insight-ctx-item insight-ctx-ok"><span class="insight-ctx-icon">🧪</span><span>Magnesium taken</span></div>`;
      }

      // Caffeine — show cumulative total AND last drink timing
      if (totalCaff > 0) {
        ctx += `<div class="insight-ctx-item ${totalCaff > 200 ? 'insight-ctx-warn' : 'insight-ctx-neutral'}"><span class="insight-ctx-icon">☕</span><span>${Math.round(totalCaff)}mg total in prior 12h</span></div>`;
        // Last caffeine drink before episode
        const lastCaff = caff12h.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
        if (lastCaff) {
          const minsBefore = Math.round((epStartMs - new Date(lastCaff.timestamp).getTime()) / 60000);
          const timeAgo = minsBefore < 60 ? `${minsBefore}m before` : `${Math.floor(minsBefore / 60)}h${minsBefore % 60 > 0 ? ` ${minsBefore % 60}m` : ''} before`;
          const dose = Math.round(lastCaff.caffeine_mg);
          ctx += `<div class="insight-ctx-item ${minsBefore < 60 ? 'insight-ctx-warn' : 'insight-ctx-neutral'}"><span class="insight-ctx-icon">☕</span><span>Last: ${dose}mg ${timeAgo}</span></div>`;
        }
      } else {
        ctx += `<div class="insight-ctx-item insight-ctx-ok"><span class="insight-ctx-icon">☕</span><span>No caffeine</span></div>`;
      }

      // Sleep
      if (sleepHrs !== null) {
        ctx += `<div class="insight-ctx-item ${sleepHrs < 6 ? 'insight-ctx-warn' : 'insight-ctx-ok'}"><span class="insight-ctx-icon">🌙</span><span>${sleepHrs}h sleep</span></div>`;
      } else {
        ctx += `<div class="insight-ctx-item insight-ctx-neutral"><span class="insight-ctx-icon">🌙</span><span>No sleep data</span></div>`;
      }

      // BP — closest reading before episode (or HR-only if no BP values)
      if (lastBp) {
        const bpCat = UI.bpCategory(lastBp.systolic, lastBp.diastolic);
        const minsBeforeEp = Math.round((epStartMs - new Date(lastBp.timestamp).getTime()) / 60000);
        const timeAgo = minsBeforeEp < 60 ? `${minsBeforeEp}m before` : `${Math.floor(minsBeforeEp / 60)}h before`;
        const hasBp = lastBp.systolic || lastBp.diastolic;
        let bpStr = hasBp ? `BP ${lastBp.systolic || '—'}/${lastBp.diastolic || '—'}` : '';
        if (lastBp.heartRate) bpStr += (bpStr ? ' ' : '') + `HR ${lastBp.heartRate}`;
        const catLabel = bpCat.label || (hasBp ? '' : 'HR only');
        const catPart = catLabel ? ` (${catLabel})` : '';
        ctx += `<div class="insight-ctx-item ${!bpCat.label || bpCat.label === 'Normal' ? 'insight-ctx-ok' : 'insight-ctx-warn'}"><span class="insight-ctx-icon">🩺</span><span>${bpStr} ${timeAgo}${catPart}</span></div>`;
      }

      // HR during AFib — BP/HR readings taken during the episode
      const epEndMs = ep.endTime ? new Date(ep.endTime).getTime() : epStartMs;
      const duringBp = bpEvents.filter(e => {
        const t = new Date(e.timestamp).getTime();
        return t >= epStartMs && t <= epEndMs && (e.heartRate || e.isDuringAFib);
      });
      if (duringBp.length > 0) {
        const hrReadings = duringBp.filter(e => e.heartRate).map(e => e.heartRate);
        if (hrReadings.length > 0) {
          const minHr = Math.min(...hrReadings);
          const maxHr = Math.max(...hrReadings);
          const hrStr = minHr === maxHr ? `${maxHr} bpm` : `${minHr}–${maxHr} bpm`;
          ctx += `<div class="insight-ctx-item insight-ctx-neutral"><span class="insight-ctx-icon">❤️</span><span>HR during episode: ${hrStr}</span></div>`;
        }
      }

      // Walk — timing relative to episode matters (during/after exercise can trigger AFib)
      if (lastWalk) {
        const walkEnd = new Date(lastWalk.endTime).getTime();
        const walkDur = lastWalk.duration_min || 0;
        const minsAfterWalk = Math.round((epStartMs - walkEnd) / 60000);
        const timeAgoStr = minsAfterWalk < 0 ? 'AFib started during walk' :
          minsAfterWalk < 60 ? `ended ${minsAfterWalk}m before AFib` :
          `ended ${Math.floor(minsAfterWalk / 60)}h${minsAfterWalk % 60 > 0 ? ` ${minsAfterWalk % 60}m` : ''} before AFib`;
        const isClose = minsAfterWalk >= -10 && minsAfterWalk <= 180; // within 3hrs of walk end
        ctx += `<div class="insight-ctx-item ${isClose ? 'insight-ctx-warn' : 'insight-ctx-ok'}"><span class="insight-ctx-icon">🚶</span><span>${walkDur}min walk, ${timeAgoStr}</span></div>`;
      }

      // Food before
      if (preFoodCal > 500) {
        ctx += `<div class="insight-ctx-item insight-ctx-warn"><span class="insight-ctx-icon">🍽️</span><span>Large meal: ${Math.round(preFoodCal)} kcal in prior 4h</span></div>`;
      } else if (preFoodCal > 0) {
        ctx += `<div class="insight-ctx-item insight-ctx-neutral"><span class="insight-ctx-icon">🍽️</span><span>${Math.round(preFoodCal)} kcal in prior 4h</span></div>`;
      }

      // Fluid in prior 24h
      if (dayFluid > 0 && dayFluid < 1500) {
        ctx += `<div class="insight-ctx-item insight-ctx-warn"><span class="insight-ctx-icon">💧</span><span>Low fluid: ${dayFluid}mL in prior 24h</span></div>`;
      } else if (dayFluid > 0) {
        ctx += `<div class="insight-ctx-item insight-ctx-ok"><span class="insight-ctx-icon">💧</span><span>${dayFluid}mL fluid in prior 24h</span></div>`;
      } else {
        ctx += `<div class="insight-ctx-item insight-ctx-warn"><span class="insight-ctx-icon">💧</span><span>No fluid logged in prior 24h</span></div>`;
      }

      // Stress level that day
      const dayStress = stressEvents.filter(e => UI.localDateKey(e.timestamp) === epDateKey)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      if (dayStress.length > 0) {
        const level = dayStress[0].level;
        const stressLabel = level <= 2 ? 'Low' : level <= 3 ? 'Moderate' : 'High';
        ctx += `<div class="insight-ctx-item ${level >= 4 ? 'insight-ctx-warn' : 'insight-ctx-ok'}"><span class="insight-ctx-icon">😰</span><span>Stress: ${level}/5 (${stressLabel})</span></div>`;
      }

      // Alcohol in prior 24h (only if user tracks alcohol)
      if (drinksAlcohol) {
        const alcohol24h = drinkEvents.filter(e => {
          const t = new Date(e.timestamp).getTime();
          return t < epStartMs && t > (epStartMs - 24 * 3600000) && (e.alcohol_units || 0) > 0;
        });
        const totalAlcohol = alcohol24h.reduce((s, e) => s + (e.alcohol_units || 0), 0);
        if (totalAlcohol > 0) {
          ctx += `<div class="insight-ctx-item insight-ctx-warn"><span class="insight-ctx-icon">🍷</span><span>${totalAlcohol} std drinks in prior 24h</span></div>`;
        }
      }

      // Onset context (stored with the episode)
      const onsetCtx = ep.onsetContext && ep.onsetContext.length > 0 ? ep.onsetContext.join(', ') : '';

      // Symptoms logged during this episode
      const epSymptoms = symptomEvents.filter(e => e.afibStartTime === ep.startTime || e.afibStartTime === ep.timestamp);
      const symptomList = epSymptoms.flatMap(e => e.symptoms || []);
      const uniqueSymptoms = [...new Set(symptomList)];

      html += `<div class="insight-episode-card">
        <div class="insight-episode-header">
          <div>
            <span class="insight-episode-date">${epDate}</span>
            <span class="insight-episode-time">${epTime}</span>
          </div>
          <span class="insight-episode-dur">${durStr}</span>
        </div>
        ${onsetCtx ? `<div class="insight-onset-label">Onset: ${onsetCtx}</div>` : ''}
        <div class="insight-ctx-grid">${ctx}</div>
        ${medDetail}
        ${uniqueSymptoms.length > 0 ? `<div class="insight-symptoms-label">Symptoms: ${uniqueSymptoms.join(', ')}</div>` : ''}
        ${ep.notes || ep.onsetNotes ? `<div class="insight-episode-notes">${[ep.onsetNotes, ep.notes].filter(Boolean).join(' · ')}</div>` : ''}
      </div>`;
    }

    // --- Section 3: Pattern Analysis ---
    html += `<div class="section-title" style="padding:var(--space-md) var(--space-md) 0">Pattern Analysis</div>`;
    html += `<p style="padding:0 var(--space-md);font-size:var(--font-xs);color:var(--text-tertiary);margin-bottom:var(--space-sm)">Comparing AFib days vs non-AFib days (last 90 days)</p>`;

    const now = Date.now();
    const d90 = 90 * 86400000;
    const recent90 = completed.filter(e => (now - new Date(e.startTime || e.timestamp).getTime()) < d90);
    const afibDateKeys = new Set(recent90.map(e => UI.localDateKey(e.startTime || e.timestamp)));
    const allDateKeys90 = new Set();
    for (let i = 0; i < 90; i++) {
      allDateKeys90.add(new Date(now - i * 86400000).toISOString().slice(0, 10));
    }
    const nonAfibDates = [...allDateKeys90].filter(d => !afibDateKeys.has(d));

    const avgForDates = (events, dates, field) => {
      if (dates.length === 0) return null;
      const total = dates.reduce((sum, dk) => {
        return sum + events.filter(e => UI.localDateKey(e.timestamp) === dk).reduce((s, e) => s + (e[field] || 0), 0);
      }, 0);
      return Math.round(total / dates.length);
    };

    const afibDates = [...afibDateKeys];

    // Caffeine comparison
    const caffAfib = avgForDates(drinkEvents, afibDates, 'caffeine_mg');
    const caffNon = avgForDates(drinkEvents, nonAfibDates, 'caffeine_mg');

    // Sleep comparison
    const sleepForDates = (dates) => {
      if (dates.length === 0) return null;
      const hrs = dates.map(dk => {
        const s = sleepEvents.find(e => {
          const wk = e.endTime ? UI.localDateKey(e.endTime) : UI.localDateKey(e.timestamp);
          return wk === dk;
        });
        return s ? (s.duration_min || 0) / 60 : null;
      }).filter(h => h !== null);
      return hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b) / hrs.length * 10) / 10 : null;
    };
    const sleepAfib = sleepForDates(afibDates);
    const sleepNon = sleepForDates(nonAfibDates);

    // Med adherence comparison
    const medAdherenceForDates = (dates) => {
      if (dates.length === 0) return null;
      const dayStats = dates.map(dk => {
        const dayM = medEvents.filter(m => UI.localDateKey(m.timestamp) === dk);
        if (dayM.length === 0) return null;
        return { taken: dayM.filter(m => m.status === 'Taken').length, total: dayM.length };
      }).filter(d => d !== null);
      if (dayStats.length === 0) return null;
      const taken = dayStats.reduce((s, d) => s + d.taken, 0);
      const total = dayStats.reduce((s, d) => s + d.total, 0);
      return total > 0 ? Math.round(taken / total * 100) : null;
    };
    const medAfib = medAdherenceForDates(afibDates);
    const medNon = medAdherenceForDates(nonAfibDates);

    // BP comparison (systolic and diastolic)
    const bpAvgForDates = (dates, field) => {
      if (dates.length === 0) return null;
      const readings = dates.flatMap(dk => bpEvents.filter(e => UI.localDateKey(e.timestamp) === dk && e[field]));
      if (readings.length === 0) return null;
      return Math.round(readings.reduce((s, e) => s + e[field], 0) / readings.length);
    };
    const sysAfib = bpAvgForDates(afibDates, 'systolic');
    const sysNon = bpAvgForDates(nonAfibDates, 'systolic');
    const diaAfib = bpAvgForDates(afibDates, 'diastolic');
    const diaNon = bpAvgForDates(nonAfibDates, 'diastolic');

    // Fluid comparison
    const fluidAfib = avgForDates(drinkEvents, afibDates, 'volume_ml');
    const fluidNon = avgForDates(drinkEvents, nonAfibDates, 'volume_ml');

    // Time of day analysis
    const hourCounts = new Array(24).fill(0);
    completed.forEach(e => {
      const h = new Date(e.startTime || e.timestamp).getHours();
      hourCounts[h]++;
    });
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const timeOfDay = peakHour < 6 ? 'Night (12am-6am)' : peakHour < 12 ? 'Morning (6am-12pm)' : peakHour < 18 ? 'Afternoon (12pm-6pm)' : 'Evening (6pm-12am)';

    html += `<div style="padding:0 var(--space-md)">`;

    const buildCompRow = (icon, label, afibVal, nonVal, unit, warnWhenHigher) => {
      if (afibVal === null && nonVal === null) return '';
      const afibStr = afibVal !== null ? `${afibVal}${unit}` : '—';
      const nonStr = nonVal !== null ? `${nonVal}${unit}` : '—';
      let diffClass = 'insight-comp-neutral';
      if (afibVal !== null && nonVal !== null && afibVal !== nonVal) {
        const isHigher = afibVal > nonVal;
        diffClass = (isHigher === warnWhenHigher) ? 'insight-comp-warn' : 'insight-comp-ok';
      }
      return `<div class="insight-comp-row ${diffClass}">
        <span class="insight-comp-icon">${icon}</span>
        <span class="insight-comp-label">${label}</span>
        <span class="insight-comp-vals">
          <span class="insight-comp-afib">${afibStr}</span>
          <span class="insight-comp-vs">vs</span>
          <span class="insight-comp-non">${nonStr}</span>
        </span>
      </div>`;
    };

    html += `<div class="insight-comp-header">
      <span></span><span></span>
      <span class="insight-comp-col-label">AFib Days</span>
      <span class="insight-comp-col-label">vs</span>
      <span class="insight-comp-col-label">Normal</span>
    </div>`;
    // Walk comparison — avg daily walk minutes on AFib vs non-AFib days
    const walkForDates = (dates) => {
      if (dates.length === 0) return null;
      const total = dates.reduce((sum, dk) => {
        return sum + walkEvents.filter(e => UI.localDateKey(e.timestamp) === dk).reduce((s, e) => s + (e.duration_min || 0), 0);
      }, 0);
      return Math.round(total / dates.length);
    };
    const walkAfib = walkForDates(afibDates);
    const walkNon = walkForDates(nonAfibDates);

    // Stress comparison
    const stressForDates = (dates) => {
      if (dates.length === 0) return null;
      const vals = dates.map(dk => {
        const ds = stressEvents.filter(e => UI.localDateKey(e.timestamp) === dk);
        return ds.length > 0 ? ds[ds.length - 1].level : null;
      }).filter(v => v !== null);
      return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b) / vals.length * 10) / 10 : null;
    };
    const stressAfib = stressForDates(afibDates);
    const stressNon = stressForDates(nonAfibDates);

    // Alcohol comparison (only if user tracks alcohol)
    let alcAfib = null, alcNon = null;
    if (drinksAlcohol) {
      const alcoholForDates = (dates) => {
        if (dates.length === 0) return null;
        const total = dates.reduce((sum, dk) => {
          return sum + drinkEvents.filter(e => UI.localDateKey(e.timestamp) === dk).reduce((s, e) => s + (e.alcohol_units || 0), 0);
        }, 0);
        return Math.round(total / dates.length * 10) / 10;
      };
      alcAfib = alcoholForDates(afibDates);
      alcNon = alcoholForDates(nonAfibDates);
    }

    html += buildCompRow('☕', 'Avg Caffeine', caffAfib, caffNon, 'mg', true);
    html += buildCompRow('🌙', 'Avg Sleep', sleepAfib, sleepNon, 'h', false);
    html += buildCompRow('💊', 'Med Adherence', medAfib, medNon, '%', false);
    html += buildCompRow('🩺', 'Avg Systolic', sysAfib, sysNon, '', true);
    html += buildCompRow('🩺', 'Avg Diastolic', diaAfib, diaNon, '', true);
    html += buildCompRow('💧', 'Avg Fluid', fluidAfib, fluidNon, 'mL', false);
    html += buildCompRow('🚶', 'Avg Walk', walkAfib, walkNon, 'min', true);
    html += buildCompRow('😰', 'Avg Stress', stressAfib, stressNon, '/5', true);
    if (drinksAlcohol && (alcAfib > 0 || alcNon > 0)) {
      html += buildCompRow('🍷', 'Avg Alcohol', alcAfib, alcNon, ' drinks', true);
    }
    html += `<div class="insight-comp-row insight-comp-neutral">
      <span class="insight-comp-icon">🕐</span>
      <span class="insight-comp-label">Most Common Time</span>
      <span class="insight-comp-vals"><span>${timeOfDay}</span></span>
    </div>`;
    // Most common onset activity (from onsetContext, last 90 days)
    const onsetCounts = {};
    recent90.forEach(ep => {
      (ep.onsetContext || []).forEach(opt => {
        onsetCounts[opt] = (onsetCounts[opt] || 0) + 1;
      });
    });
    const episodesWithOnset = recent90.filter(e => (e.onsetContext || []).length > 0);
    const topOnset = Object.entries(onsetCounts).sort((a, b) => b[1] - a[1])[0];
    if (topOnset && episodesWithOnset.length > 0) {
      const epCountWithTop = episodesWithOnset.filter(e => (e.onsetContext || []).includes(topOnset[0])).length;
      const pct = Math.round(epCountWithTop / episodesWithOnset.length * 100) || 0;
      html += `<div class="insight-comp-row insight-comp-neutral">
        <span class="insight-comp-icon">📍</span>
        <span class="insight-comp-label">Most Common Onset</span>
        <span class="insight-comp-vals"><span>${topOnset[0]} (${pct}%)</span></span>
      </div>`;
    }
    // Most common symptoms (from afib_symptom events)
    const symptomCounts = {};
    recent90.forEach(ep => {
      const epSymptoms = symptomEvents.filter(e => e.afibStartTime === ep.startTime || e.afibStartTime === ep.timestamp);
      epSymptoms.flatMap(e => e.symptoms || []).forEach(s => {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      });
    });
    const topSymptom = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1])[0];
    const epsWithSymptoms = recent90.filter(ep => symptomEvents.some(e => (e.afibStartTime === ep.startTime || e.afibStartTime === ep.timestamp) && (e.symptoms || []).length > 0));
    if (topSymptom && epsWithSymptoms.length > 0) {
      const epCountWithSymptom = epsWithSymptoms.filter(ep => {
        const epS = symptomEvents.filter(e => e.afibStartTime === ep.startTime || e.afibStartTime === ep.timestamp);
        return epS.some(e => (e.symptoms || []).includes(topSymptom[0]));
      }).length;
      const pct = Math.round(epCountWithSymptom / epsWithSymptoms.length * 100) || 0;
      html += `<div class="insight-comp-row insight-comp-neutral">
        <span class="insight-comp-icon">💓</span>
        <span class="insight-comp-label">Most Common Symptom</span>
        <span class="insight-comp-vals"><span>${topSymptom[0]} (${pct}%)</span></span>
      </div>`;
    }
    html += `</div>`;

    // --- Section 4: Potential Triggers Ranking ---
    html += `<div class="section-title" style="padding:var(--space-md) var(--space-md) 0">Potential Triggers</div>`;
    html += `<p style="padding:0 var(--space-md);font-size:var(--font-xs);color:var(--text-tertiary);margin-bottom:var(--space-sm)">Factors present before episodes (last 90 days)</p>`;

    const triggers = [];

    if (recent90.length > 0) {
      const medLookup = (medications || []).reduce((acc, m) => { acc[m.name] = m; return acc; }, {});
      // Missed AFib-relevant meds (Sotalol, blood thinners, etc.)
      let missedAfibCount = 0;
      recent90.forEach(ep => {
        const dk = UI.localDateKey(ep.startTime || ep.timestamp);
        const prevDk = new Date(new Date(ep.startTime || ep.timestamp).getTime() - 86400000).toISOString().slice(0, 10);
        const dayM = medEvents.filter(m => (UI.localDateKey(m.timestamp) === dk || UI.localDateKey(m.timestamp) === prevDk) && m.status === 'Skipped');
        if (dayM.some(m => (medLookup[m.medName || m.name] || {}).afibRelevant)) missedAfibCount++;
      });
      if (missedAfibCount > 0) triggers.push({ label: 'Missed AFib med', pct: Math.round(missedAfibCount / recent90.length * 100), icon: '💊', color: '#EF4444' });
      // Missed any meds
      let missedCount = 0;
      recent90.forEach(ep => {
        const dk = UI.localDateKey(ep.startTime || ep.timestamp);
        const prevDk = new Date(new Date(ep.startTime || ep.timestamp).getTime() - 86400000).toISOString().slice(0, 10);
        const dayM = medEvents.filter(m => UI.localDateKey(m.timestamp) === dk || UI.localDateKey(m.timestamp) === prevDk);
        if (dayM.some(m => m.status === 'Skipped')) missedCount++;
      });
      if (missedCount > 0 && missedAfibCount === 0) triggers.push({ label: 'Missed medication', pct: Math.round(missedCount / recent90.length * 100), icon: '💊', color: '#F59E0B' });

      // High caffeine (above non-afib average)
      if (caffNon !== null) {
        let highCaffCount = 0;
        recent90.forEach(ep => {
          const dk = UI.localDateKey(ep.startTime || ep.timestamp);
          const dayCaff = drinkEvents.filter(e => UI.localDateKey(e.timestamp) === dk).reduce((s, e) => s + (e.caffeine_mg || 0), 0);
          if (dayCaff > caffNon) highCaffCount++;
        });
        if (highCaffCount > 0) triggers.push({ label: 'Above-avg caffeine', pct: Math.round(highCaffCount / recent90.length * 100), icon: '☕', color: '#92400E' });
      }

      // Poor sleep (<6h)
      let poorSleepCount = 0;
      recent90.forEach(ep => {
        const dk = UI.localDateKey(ep.startTime || ep.timestamp);
        const s = sleepEvents.find(e => {
          const wk = e.endTime ? UI.localDateKey(e.endTime) : UI.localDateKey(e.timestamp);
          return wk === dk;
        });
        if (s && (s.duration_min || 0) < 360) poorSleepCount++;
      });
      if (poorSleepCount > 0) triggers.push({ label: 'Poor sleep (<6h)', pct: Math.round(poorSleepCount / recent90.length * 100), icon: '🌙', color: '#6366F1' });

      // Elevated BP (systolic > 140)
      let highBpCount = 0;
      recent90.forEach(ep => {
        const dk = UI.localDateKey(ep.startTime || ep.timestamp);
        const dayBp = bpEvents.filter(e => UI.localDateKey(e.timestamp) === dk && e.systolic > 140);
        if (dayBp.length > 0) highBpCount++;
      });
      if (highBpCount > 0) triggers.push({ label: 'Elevated BP (>140)', pct: Math.round(highBpCount / recent90.length * 100), icon: '🩺', color: '#EF4444' });

      // Low fluid (<1500mL in 24h before)
      let lowFluidCount = 0;
      recent90.forEach(ep => {
        const epMs = new Date(ep.startTime || ep.timestamp).getTime();
        const fluid24h = drinkEvents.filter(e => {
          const t = new Date(e.timestamp).getTime();
          return t < epMs && t > (epMs - 24 * 3600000);
        }).reduce((s, e) => s + (e.volume_ml || 0), 0);
        if (fluid24h > 0 && fluid24h < 1500) lowFluidCount++;
      });
      if (lowFluidCount > 0) triggers.push({ label: 'Low fluid (<1.5L/24h)', pct: Math.round(lowFluidCount / recent90.length * 100), icon: '💧', color: '#3B82F6' });

      // Large meal (>500kcal in 4h before)
      let largeMealCount = 0;
      recent90.forEach(ep => {
        const epMs = new Date(ep.startTime || ep.timestamp).getTime();
        const pre4h = foodEvents.filter(e => {
          const t = new Date(e.timestamp).getTime();
          return t < epMs && t > (epMs - 4 * 3600000);
        }).reduce((s, e) => s + (e.calories || 0), 0);
        if (pre4h > 500) largeMealCount++;
      });
      if (largeMealCount > 0) triggers.push({ label: 'Large meal before', pct: Math.round(largeMealCount / recent90.length * 100), icon: '🍽️', color: '#F59E0B' });

      // Recent exercise (walk ended within 3h before episode)
      let recentExCount = 0;
      recent90.forEach(ep => {
        const epMs = new Date(ep.startTime || ep.timestamp).getTime();
        const recentWalk = walkEvents.find(e => {
          if (!e.endTime) return false;
          const walkEnd = new Date(e.endTime).getTime();
          return walkEnd < epMs && walkEnd > (epMs - 3 * 3600000);
        });
        if (recentWalk) recentExCount++;
      });
      if (recentExCount > 0) triggers.push({ label: 'Exercise within 3h', pct: Math.round(recentExCount / recent90.length * 100), icon: '🚶', color: '#10B981' });

      // Acute caffeine (>80mg single dose within 1h before)
      let acuteCaffCount = 0;
      recent90.forEach(ep => {
        const epMs = new Date(ep.startTime || ep.timestamp).getTime();
        const acute = allFoodDrink.find(e => {
          const t = new Date(e.timestamp).getTime();
          return (e.caffeine_mg || 0) >= 80 && t < epMs && t > (epMs - 3600000);
        });
        if (acute) acuteCaffCount++;
      });
      if (acuteCaffCount > 0) triggers.push({ label: 'Caffeine within 1h', pct: Math.round(acuteCaffCount / recent90.length * 100), icon: '☕', color: '#92400E' });

      // High stress (4-5) on AFib day
      let highStressCount = 0;
      recent90.forEach(ep => {
        const dk = UI.localDateKey(ep.startTime || ep.timestamp);
        const dayS = stressEvents.filter(e => UI.localDateKey(e.timestamp) === dk);
        if (dayS.some(s => s.level >= 4)) highStressCount++;
      });
      if (highStressCount > 0) triggers.push({ label: 'High stress (4-5)', pct: Math.round(highStressCount / recent90.length * 100), icon: '😰', color: '#8B5CF6' });

      // Alcohol in prior 24h (only if user tracks alcohol)
      if (drinksAlcohol) {
        let alcoholCount = 0;
        recent90.forEach(ep => {
          const epMs = new Date(ep.startTime || ep.timestamp).getTime();
          const alc = drinkEvents.filter(e => {
            const t = new Date(e.timestamp).getTime();
            return t < epMs && t > (epMs - 24 * 3600000) && (e.alcohol_units || 0) > 0;
          }).reduce((s, e) => s + (e.alcohol_units || 0), 0);
          if (alc > 0) alcoholCount++;
        });
        if (alcoholCount > 0) triggers.push({ label: 'Alcohol in prior 24h', pct: Math.round(alcoholCount / recent90.length * 100), icon: '🍷', color: '#DC2626' });
      }

      // Missed magnesium/electrolytes
      const mgPat = /magnesium|mag\b|electrolyte|potassium/i;
      let mgMissedCount = 0;
      recent90.forEach(ep => {
        const dk = UI.localDateKey(ep.startTime || ep.timestamp);
        const prevDk = new Date(new Date(ep.startTime || ep.timestamp).getTime() - 86400000).toISOString().slice(0, 10);
        const dayM = medEvents.filter(m => (UI.localDateKey(m.timestamp) === dk || UI.localDateKey(m.timestamp) === prevDk) && mgPat.test(m.medName || m.name || ''));
        if (dayM.some(m => m.status === 'Skipped')) mgMissedCount++;
      });
      if (mgMissedCount > 0) triggers.push({ label: 'Magnesium missed', pct: Math.round(mgMissedCount / recent90.length * 100), icon: '🧪', color: '#059669' });

      // Onset context triggers — e.g. "Resting at onset" in X% of episodes
      const onsetTriggerEpisodes = {};
      recent90.forEach(ep => {
        (ep.onsetContext || []).forEach(opt => {
          if (!onsetTriggerEpisodes[opt]) onsetTriggerEpisodes[opt] = new Set();
          onsetTriggerEpisodes[opt].add(ep.startTime || ep.timestamp);
        });
      });
      Object.entries(onsetTriggerEpisodes).forEach(([opt, epSet]) => {
        const pct = Math.round(epSet.size / recent90.length * 100);
        if (pct >= 20) {
          const iconMap = { Resting: '🛋️', Sleeping: '😴', Eating: '🍽️', Exercising: '🏃', Stressed: '😰', 'Bending Over': '🙇', 'Just Woke Up': '☀️', Other: '📌' };
          triggers.push({ label: `${opt} at onset`, pct, icon: iconMap[opt] || '📍', color: '#64748B' });
        }
      });
    }

    // Sort by percentage descending
    triggers.sort((a, b) => b.pct - a.pct);

    if (triggers.length > 0) {
      html += `<div style="padding:0 var(--space-md) var(--space-lg)">`;
      triggers.forEach(t => {
        html += `<div class="insight-trigger-row">
          <span class="insight-trigger-icon">${t.icon}</span>
          <span class="insight-trigger-label">${t.label}</span>
          <div class="insight-trigger-bar-bg">
            <div class="insight-trigger-bar" style="width:${t.pct}%;background:${t.color}"></div>
          </div>
          <span class="insight-trigger-pct" style="color:${t.color}">${t.pct}%</span>
        </div>`;
      });
      html += `</div>`;
    } else {
      html += `<div style="padding:var(--space-sm) var(--space-md) var(--space-lg);color:var(--text-tertiary);font-size:var(--font-sm)">Not enough data yet to identify patterns. Keep logging!</div>`;
    }

    content.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /* ---------- Medication Reminders ---------- */
  async checkMedicationReminders() {
    const profileComplete = await DB.getSetting('profileComplete');
    const needsSetupChoice = await DB.getSetting('needsSetupChoice');
    if (!profileComplete || needsSetupChoice) return;

    const meds = await DB.getMedications();
    if (!meds || meds.length === 0) return;

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
      const afibBadge = med.afibRelevant ? ' <span class="med-afib-badge">AFib</span>' : '';
      html += `
        <div class="entry-item" onclick="App.editMedication('${med.id}')">
          <div class="entry-icon med"><i data-lucide="pill"></i></div>
          <div class="entry-body">
            <div class="entry-title">${med.name}${afibBadge}</div>
            <div class="entry-subtitle">${med.dosage} — ${med.schedule}</div>
          </div>
          <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-tertiary)"></i>
        </div>`;
    });
    html += '</div>';
    html += `<div style="padding:var(--space-md);display:flex;flex-direction:column;gap:8px;">
      <button class="btn btn-secondary" onclick="App.addNewMedication()"><i data-lucide="plus"></i> Add Medication</button>
      <button class="btn btn-primary" onclick="App.closeFullscreenModal()">Done</button>
    </div>`;

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
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="med-setting-afib" ${med.afibRelevant ? 'checked' : ''}>
          AFib-relevant (e.g. Sotalol, blood thinners)
        </label>
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
      schedule: this._getToggleValue('med-setting-schedule') || 'Morning',
      afibRelevant: document.getElementById('med-setting-afib')?.checked || false
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
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="med-setting-afib">
          AFib-relevant (e.g. Sotalol, blood thinners)
        </label>
      </div>`;
    const footer = `
      <button class="btn btn-primary" onclick="App.saveNewMedication()">Add</button>
      <button class="btn btn-ghost" onclick="App._cancelAddMedication()">Cancel</button>`;
    UI.closeFullscreenModal();
    setTimeout(() => {
      UI.openModal('Add Medication', body, footer);
      this.setupToggleGroupListeners();
    }, 350);
  },

  async _cancelAddMedication() {
    UI.closeModal();
    await this._openMedicationSettings();
  },

  async saveNewMedication() {
    const name = document.getElementById('med-setting-name').value.trim();
    if (!name) { UI.showToast('Please enter a name', 'error'); return; }
    await DB.addMedication({
      name,
      dosage: document.getElementById('med-setting-dosage').value.trim(),
      schedule: this._getToggleValue('med-setting-schedule') || 'Both',
      afibRelevant: document.getElementById('med-setting-afib')?.checked || false
    });
    UI.closeModal();
    UI.showToast('Medication added', 'success');
    this.switchTab('home');
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
    const userName = await DB.getSetting('userName') || '';
    const userDOB = await DB.getSetting('userDOB') || '';
    const userHeight = await DB.getSetting('userHeight') || '';
    const userGender = await DB.getSetting('userGender') || '';
    const goalWeight = await DB.getSetting('goalWeight') || '';
    const proteinPerKg = (await DB.getSetting('proteinPerKg')) || 1.6;
    const drinksAlcohol = await DB.getSetting('drinksAlcohol') || 'no';

    const body = `
      <div class="form-group"><label>Name</label><input type="text" class="form-input" id="setting-name" value="${userName}"></div>
      <div class="form-group"><label>Date of Birth</label><input type="date" class="form-input" id="setting-dob" value="${userDOB}"></div>
      <div class="form-group">
        <label>Gender</label>
        <select class="form-input" id="setting-gender">
          <option value="">—</option>
          <option value="male"${userGender === 'male' ? ' selected' : ''}>Male</option>
          <option value="female"${userGender === 'female' ? ' selected' : ''}>Female</option>
        </select>
      </div>
      <div class="form-group"><label>Height (cm)</label><input type="number" class="form-input" id="setting-height" value="${userHeight}" inputmode="numeric"></div>
      <div class="form-group"><label>Goal Weight (kg)</label><input type="number" step="0.1" class="form-input" id="setting-goal-weight" value="${goalWeight}" inputmode="decimal" placeholder="e.g., 100"></div>
      <div class="form-group">
        <label>Do you drink alcohol?</label>
        <select class="form-input" id="setting-drinks-alcohol">
          <option value="no"${drinksAlcohol === 'no' ? ' selected' : ''}>No</option>
          <option value="yes"${drinksAlcohol === 'yes' ? ' selected' : ''}>Yes</option>
        </select>
      </div>
      <div class="form-group"><label>Protein Target (g per kg of goal weight)</label><input type="number" step="0.1" class="form-input" id="setting-protein-per-kg" value="${proteinPerKg}" inputmode="decimal" placeholder="1.6">
        <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">${goalWeight ? `Current target: ${Math.round(goalWeight * proteinPerKg)}g/day (${goalWeight}kg × ${proteinPerKg}g)` : 'Set goal weight to calculate daily target'}</div>
      </div>`;
    const footer = `<button class="btn btn-primary" onclick="App.saveUserInfo()">Save</button>`;
    UI.openModal('Personal Information', body, footer);
  },

  async saveUserInfo() {
    await DB.setSetting('userName', document.getElementById('setting-name').value.trim());
    await DB.setSetting('userDOB', document.getElementById('setting-dob').value);
    await DB.setSetting('userGender', document.getElementById('setting-gender').value);
    await DB.setSetting('userHeight', parseInt(document.getElementById('setting-height').value) || null);
    await DB.setSetting('goalWeight', parseFloat(document.getElementById('setting-goal-weight').value) || null);
    await DB.setSetting('drinksAlcohol', document.getElementById('setting-drinks-alcohol').value || 'no');
    await DB.setSetting('proteinPerKg', parseFloat(document.getElementById('setting-protein-per-kg').value) || 1.6);
    UI.closeModal();
    UI.showToast('Personal info saved', 'success');
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
      await Export.generateCSV(false);
      UI.showToast('CSV exported', 'success');
    } catch (e) {
      UI.showToast('Export failed: ' + e.message, 'error');
    }
  },

  async exportDemoCSV() {
    try {
      await Export.generateCSV(true);
      if (Demo.isActive) UI.showToast('Demo CSV exported', 'success');
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

  async confirmDeleteAllData() {
    const body = `<p style="margin-bottom:var(--space-md);color:var(--text-secondary);">Do you want to create a full backup before deleting? This will download all your data as a JSON file.</p>`;
    const footer = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button class="btn btn-primary" onclick="App._deleteAllDataFlow('backup')">Backup & Delete</button>
        <button class="btn btn-secondary" onclick="App._deleteAllDataFlow('skip')">Skip backup</button>
        <button class="btn btn-ghost" onclick="UI.closeModal()">Cancel</button>
      </div>`;
    UI.openModal('Delete All Data', body, footer);
  },

  async _deleteAllDataFlow(choice) {
    UI.closeModal();
    if (choice === 'backup') {
      await this.exportJSON();
    }
    const confirmed = await UI.confirm('Are you sure?', 'This will permanently delete ALL your data. This cannot be undone.', 'Yes, delete everything');
    if (!confirmed) return;
    try {
      await DB.importAll({ events: [], foodLibrary: [], drinkLibrary: [], medications: [], settings: [], activeToggles: [] });
      await DB.setSetting('needsSetupChoice', true);
      await this.loadToggleStates();
      UI.showToast('All data deleted', 'info');
      this._showSetupChoice();
    } catch (e) {
      UI.showToast('Delete failed: ' + e.message, 'error');
    }
  },

  _showSetupChoice() {
    const body = `<p style="color:var(--text-secondary);margin-bottom:var(--space-md);line-height:1.5">Would you like to restore from a backup or start with a new profile?</p>`;
    const footer = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button class="btn btn-primary" onclick="App._setupChoiceRestore()">Restore from backup</button>
        <button class="btn btn-secondary" onclick="App._setupChoiceNew()">Start new profile</button>
      </div>`;
    UI.openModal('Set Up Heart Tracker', body, footer, true);
  },

  _setupChoiceRestore() {
    UI.closeModal();
    this.importJSON(true);
  },

  async _setupChoiceNew() {
    UI.closeModal();
    await DB.setSetting('needsSetupChoice', null);
    await DB.seedDefaults();
    this._showWelcomePopup();
  },

  importJSON(skipConfirmForSetup = false) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!skipConfirmForSetup) {
          const confirmed = await UI.confirm('Restore Backup', 'This will replace ALL current data. Are you sure?', 'Restore');
          if (!confirmed) return;
        }
        await DB.importAll(data);
        if (skipConfirmForSetup) await DB.setSetting('needsSetupChoice', null);
        UI.showToast('Backup restored successfully', 'success');
        await this.loadToggleStates();
        this.renderCurrentTab();
        if (this.currentTab === 'history') this.refreshHistory();
      } catch (e) {
        UI.showToast('Import failed: ' + e.message, 'error');
      }
    };
    input.click();
  },

  /* ---------- Version Check ---------- */
  async checkForUpdates() {
    try {
      // Force SW update check
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update();
      }
      const response = await fetch('version.json?t=' + Date.now());
      const remote = await response.json();
      if (remote.version !== this.APP_VERSION) {
        this._showUpdateBanner(remote.version);
      } else {
        // Double-check: is there a waiting SW even though versions match?
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && reg.waiting) {
            this._showUpdateBanner();
            return;
          }
        }
        UI.showToast('App is up to date! (v' + this.APP_VERSION + ')', 'success');
      }
    } catch (e) {
      UI.showToast('Could not check for updates', 'error');
    }
  },

  /* Silent auto-check on launch (no error toast if offline) */
  async _autoCheckForUpdates() {
    try {
      // Force the SW to check for updates
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          reg.update().catch(() => {});

          // If a new SW is already waiting, show the banner
          if (reg.waiting) {
            this._showUpdateBanner();
            return;
          }
          // Listen for future updates found during this session
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

      // Also check version.json directly (catches cases where SW hasn't updated yet)
      const response = await fetch('version.json?t=' + Date.now());
      const remote = await response.json();
      if (remote.version !== this.APP_VERSION) {
        this._showUpdateBanner(remote.version);
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
        <button onclick="App.applyUpdate()">Update Now</button>
        <button class="dismiss" onclick="this.closest('#update-banner').remove()">✕</button>
      </div>`;
    document.body.prepend(banner);
  },

  async applyUpdate() {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          // If a new SW is waiting, tell it to activate
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          // Clear all caches to force fresh downloads
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      }
    } catch (e) {
      console.log('Update cleanup error:', e);
    }
    // Hard reload — bypasses cache
    window.location.reload(true);
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
  /* Compare current vs previous value and return badge info */
  _vsBadge(current, previous, lowerIsBetter = false) {
    if (previous === 0 && current === 0) return {};
    if (previous === 0) return { badge: 'New', badgeColor: '#6B7280', bg: 'rgba(107,114,128,0.1)' };
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct === 0) return { badge: '— 0%', badgeColor: '#6B7280', bg: 'rgba(107,114,128,0.1)' };
    const isGood = lowerIsBetter ? pct < 0 : pct > 0;
    const arrow = pct > 0 ? '↑' : '↓';
    const color = isGood ? '#10B981' : '#EF4444';
    return { badge: `${arrow} ${Math.abs(pct)}%`, badgeColor: color, bg: isGood ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' };
  },

  _calcAfibStats(events) {
    const completed = events.filter(e => e.endTime);
    const week = this._getWeekRange(this._weekOffset);
    const prev = this._getWeekRange(this._weekOffset + 1);
    const weekEvents = this._eventsInWeek(completed, week);
    const prevEvents = this._eventsInWeek(completed, prev);

    const weekEpisodes = weekEvents.length;
    const prevEpisodes = prevEvents.length;
    const weekDur = weekEvents.reduce((s, e) => s + (e.duration_min || 0), 0);
    const prevDur = prevEvents.reduce((s, e) => s + (e.duration_min || 0), 0);
    const avgDur = weekEvents.length > 0
      ? Math.round(weekDur / weekEvents.length)
      : 0;
    const longest = weekEvents.length > 0
      ? Math.max(...weekEvents.map(e => e.duration_min || 0))
      : 0;

    // Monthly summary (navigable)
    const rightMonth = this._getMonthRange(this._monthOffset);
    const leftMonth = this._getMonthRange(this._monthOffset + 1);
    const rightMonthEvents = this._eventsInMonth(completed, rightMonth);
    const leftMonthEvents = this._eventsInMonth(completed, leftMonth);
    const rightMonthDur = rightMonthEvents.reduce((s, e) => s + (e.duration_min || 0), 0);
    const leftMonthDur = leftMonthEvents.reduce((s, e) => s + (e.duration_min || 0), 0);

    const stats = [
      { label: 'Episodes', value: weekEpisodes, unit: '', ...this._vsBadge(weekEpisodes, prevEpisodes, true) },
      { label: 'Total Duration', value: UI.formatDuration(Math.round(weekDur)), ...this._vsBadge(weekDur, prevDur, true) },
      { label: 'Avg Duration', value: UI.formatDuration(avgDur) },
      { label: 'Longest', value: UI.formatDuration(longest) }
    ];
    stats._monthlySummary = {
      rightLabel: rightMonth.label,
      leftLabel: leftMonth.label,
      rightCount: rightMonthEvents.length,
      leftCount: leftMonthEvents.length,
      rightDur: UI.formatDuration(Math.round(rightMonthDur)),
      leftDur: UI.formatDuration(Math.round(leftMonthDur)),
      badge: this._vsBadge(rightMonthEvents.length, leftMonthEvents.length, true),
      rightIsCurrent: this._monthOffset === 0,
      monthOffset: this._monthOffset
    };
    return stats;
  },

  _calcBpStats(events, walkEvents) {
    if (events.length === 0) return [];
    const week = this._getWeekRange(this._weekOffset);
    const prev = this._getWeekRange(this._weekOffset + 1);
    const weekEvents = this._eventsInWeek(events, week);
    const prevEvents = this._eventsInWeek(events, prev);
    const walks = walkEvents || this._cachedWalkEvents || [];

    const avgArr = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b) / arr.length) : null;

    // Context-specific averages for the week
    const contextAvg = (ctx) => {
      const filtered = weekEvents.filter(e => this.classifyBpReading(e, walks) === ctx);
      const sys = filtered.filter(e => e.systolic).map(e => e.systolic);
      const dia = filtered.filter(e => e.diastolic).map(e => e.diastolic);
      const s = avgArr(sys);
      const d = avgArr(dia);
      const cat = s != null ? UI.bpCategory(s, d) : { color: '', bg: '', label: '' };
      return { value: s != null ? `${s}/${d}` : '—', unit: s != null ? 'mmHg' : '', count: filtered.length, cat };
    };

    const morning = contextAvg('morning');
    const postWalk = contextAvg('post-walk');
    const evening = contextAvg('evening');

    // Avg HR for the week
    const wHr = weekEvents.filter(e => e.heartRate).map(e => e.heartRate);
    const pHr = prevEvents.filter(e => e.heartRate).map(e => e.heartRate);
    const avgHr = wHr.length ? avgArr(wHr) : '—';
    const prevAvgHr = pHr.length ? avgArr(pHr) : 0;

    return [
      { label: 'Morning Avg', value: morning.value, unit: morning.unit, color: morning.cat.color, bg: morning.cat.bg, badge: morning.cat.label },
      { label: 'Post-Walk Avg', value: postWalk.value, unit: postWalk.unit, color: postWalk.cat.color, bg: postWalk.cat.bg, badge: postWalk.cat.label },
      { label: 'Evening Avg', value: evening.value, unit: evening.unit, color: evening.cat.color, bg: evening.cat.bg, badge: evening.cat.label },
      { label: 'Avg HR', value: avgHr, unit: 'BPM',
        ...(typeof avgHr === 'number' && prevAvgHr ? this._vsBadge(avgHr, prevAvgHr, true) : {}) },
      { label: 'Readings', value: weekEvents.length,
        ...(prevEvents.length > 0 ? this._vsBadge(weekEvents.length, prevEvents.length) : {}) }
    ];
  },

  _calcSleepStats(events) {
    const completed = events.filter(e => e.endTime);
    if (completed.length === 0) return [];
    const week = this._getWeekRange(this._weekOffset);
    const prev = this._getWeekRange(this._weekOffset + 1);
    const weekEvents = this._eventsInWeek(completed, week);
    const prevEvents = this._eventsInWeek(completed, prev);

    const weekDurations = weekEvents.map(e => e.duration_min || 0);
    const prevDurations = prevEvents.map(e => e.duration_min || 0);
    const weekAvg = weekDurations.length > 0 ? Math.round(weekDurations.reduce((a, b) => a + b) / weekDurations.length) : 0;
    const prevAvg = prevDurations.length > 0 ? Math.round(prevDurations.reduce((a, b) => a + b) / prevDurations.length) : 0;
    const best = weekDurations.length > 0 ? Math.max(...weekDurations) : 0;
    const worst = weekDurations.length > 0 ? Math.min(...weekDurations) : 0;

    return [
      { label: 'Avg Sleep', value: UI.formatDuration(weekAvg), ...this._vsBadge(weekAvg, prevAvg) },
      { label: 'Best Night', value: UI.formatDuration(best) },
      { label: 'Worst Night', value: UI.formatDuration(worst) },
      { label: 'Nights Logged', value: weekEvents.length }
    ];
  },

  async _calcWeightStats(events) {
    if (events.length === 0) return [];
    const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const current = sorted[sorted.length - 1].weight_kg;
    const first = sorted[0].weight_kg;
    const totalChange = Math.round((current - first) * 10) / 10;

    // Lost this week: difference between earliest reading in last 7 days and latest
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const weekEvents = sorted.filter(e => new Date(e.timestamp) >= weekAgo);
    let weekChange = 0;
    if (weekEvents.length >= 2) {
      weekChange = Math.round((weekEvents[weekEvents.length - 1].weight_kg - weekEvents[0].weight_kg) * 10) / 10;
    }

    const goalWeight = await DB.getSetting('goalWeight');
    const userHeight = await DB.getSetting('userHeight');
    const heightCm = userHeight ? parseInt(userHeight, 10) : null;
    const bmi = (heightCm && heightCm > 0) ? Math.round((current / Math.pow(heightCm / 100, 2)) * 10) / 10 : null;

    const stats = [
      { label: 'Current', value: current, unit: 'kg' },
      ...(bmi != null ? [{ label: 'BMI', value: bmi, unit: '' }] : []),
      { label: 'Starting', value: first, unit: 'kg' },
      { label: 'Total Change', value: (totalChange <= 0 ? '' : '+') + totalChange, unit: 'kg' },
      { label: 'This Week', value: (weekChange <= 0 ? '-' : '+') + Math.abs(weekChange), unit: 'kg' }
    ];
    if (goalWeight) {
      const toGo = Math.round((current - goalWeight) * 10) / 10;
      const totalJourney = Math.abs(first - goalWeight);
      const completed = totalJourney > 0 ? Math.round(Math.abs(first - current) / totalJourney * 100) : 0;
      const pctDisplay = completed > 100 ? 100 : completed;
      stats.push({ label: 'Goal', value: goalWeight, unit: 'kg' });
      stats.push({ label: 'To Go', value: (toGo <= 0 ? '' : '-') + Math.abs(toGo), unit: 'kg', badge: `${pctDisplay}%`, badgeColor: '#10B981', bg: 'rgba(16,185,129,0.12)' });
    }
    return stats;
  },

  _calcActivityStats(walks, steps) {
    const week = this._getWeekRange(this._weekOffset);
    const prev = this._getWeekRange(this._weekOffset + 1);
    const completedWalks = walks.filter(w => w.endTime);

    const weekWalks = this._eventsInWeek(completedWalks, week);
    const prevWalks = this._eventsInWeek(completedWalks, prev);
    const weekSteps = steps.filter(s => {
      const d = new Date(s.date || s.timestamp);
      return d >= week.start && d <= week.end;
    });
    const prevStepsList = steps.filter(s => {
      const d = new Date(s.date || s.timestamp);
      return d >= prev.start && d <= prev.end;
    });

    const weekWalkMin = weekWalks.reduce((s, w) => s + (w.duration_min || 0), 0);
    const prevWalkMin = prevWalks.reduce((s, w) => s + (w.duration_min || 0), 0);
    const weekStepTotal = weekSteps.reduce((s, e) => s + (e.steps || 0), 0);
    const prevStepTotal = prevStepsList.reduce((s, e) => s + (e.steps || 0), 0);

    // Daily averages for this week
    const weekWalkDays = weekWalks.length > 0 ? Math.round(weekWalkMin / new Set(weekWalks.map(w => UI.localDateKey(w.timestamp))).size) : 0;
    const weekStepDays = weekSteps.length > 0 ? Math.round(weekStepTotal / weekSteps.length) : 0;

    // Walk: always show today (so user notices if they haven't walked yet)
    const today = UI.todayStr();
    const todayWalks = completedWalks.filter(w => UI.localDateKey(w.timestamp) === today);
    const todayWalkMin = todayWalks.reduce((s, w) => s + (w.duration_min || 0), 0);

    // Steps: show today's, or yesterday's if within 24 hrs, otherwise None
    const todaySteps = steps.find(s => s.date === today);
    let recentSteps = todaySteps;
    let stepsLabel = "Today's Steps";
    if (!recentSteps) {
      const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sorted = [...steps].sort((a, b) => (b.date || b.timestamp).localeCompare(a.date || a.timestamp));
      const latest = sorted[0];
      if (latest && new Date(latest.date || latest.timestamp) >= cutoff24h) {
        recentSteps = latest;
        stepsLabel = "Yesterday's Steps";
      }
    }

    return [
      { label: "Today's Walk", value: todayWalkMin > 0 ? UI.formatDuration(todayWalkMin) : 'None' },
      { label: stepsLabel, value: recentSteps ? recentSteps.steps.toLocaleString() : 'None' },
      { label: 'Total Walk', value: UI.formatDuration(weekWalkMin), ...this._vsBadge(weekWalkMin, prevWalkMin) },
      { label: 'Total Steps', value: weekStepTotal.toLocaleString(), ...this._vsBadge(weekStepTotal, prevStepTotal) },
      { label: 'Avg Walk/Day', value: UI.formatDuration(weekWalkDays) },
      { label: 'Avg Steps/Day', value: weekStepDays.toLocaleString() }
    ];
  },

  async _calcNutritionStats(events, drinksAlcohol = false) {
    const week = this._getWeekRange(this._weekOffset);
    const prev = this._getWeekRange(this._weekOffset + 1);
    const weekEvents = this._eventsInWeek(events || [], week);
    const prevEvents = this._eventsInWeek(events || [], prev);

    const sumField = (arr, field) => arr.reduce((s, e) => s + (e[field] || 0), 0);
    const wCal = Math.round(sumField(weekEvents, 'calories'));
    const pCal = Math.round(sumField(prevEvents, 'calories'));
    const wProt = Math.round(sumField(weekEvents, 'protein_g'));
    const pProt = Math.round(sumField(prevEvents, 'protein_g'));
    const wCarbs = Math.round(sumField(weekEvents, 'carbs_g'));
    const wFat = Math.round(sumField(weekEvents, 'fat_g'));
    const wSodium = Math.round(sumField(weekEvents, 'sodium_mg'));
    const pSodium = Math.round(sumField(prevEvents, 'sodium_mg'));
    const wCaffeine = Math.round(weekEvents.filter(e => e.eventType === 'drink').reduce((s, e) => s + (e.caffeine_mg || 0), 0));
    const pCaffeine = Math.round(prevEvents.filter(e => e.eventType === 'drink').reduce((s, e) => s + (e.caffeine_mg || 0), 0));
    const wFluid = weekEvents.filter(e => e.eventType === 'drink').reduce((s, e) => s + (e.volume_ml || 0), 0);
    const pFluid = prevEvents.filter(e => e.eventType === 'drink').reduce((s, e) => s + (e.volume_ml || 0), 0);
    const wAlcohol = drinksAlcohol ? weekEvents.filter(e => e.eventType === 'drink').reduce((s, e) => s + (e.alcohol_units || 0), 0) : 0;
    const pAlcohol = drinksAlcohol ? prevEvents.filter(e => e.eventType === 'drink').reduce((s, e) => s + (e.alcohol_units || 0), 0) : 0;

    // Daily averages
    const days = new Set(weekEvents.map(e => UI.localDateKey(e.timestamp))).size || 1;
    const prevDays = new Set(prevEvents.map(e => UI.localDateKey(e.timestamp))).size || 1;
    const avg = (total, d) => Math.round(total / d);
    const avgCal = avg(wCal, days);       const pAvgCal = avg(pCal, prevDays);
    const avgProt = avg(wProt, days);     const pAvgProt = avg(pProt, prevDays);
    const avgCarbs = avg(wCarbs, days);
    const avgFat = avg(wFat, days);
    const avgSodium = avg(wSodium, days); const pAvgSodium = avg(pSodium, prevDays);
    const avgCaff = avg(wCaffeine, days); const pAvgCaff = avg(pCaffeine, prevDays);
    const avgFluid = avg(wFluid, days);   const pAvgFluid = avg(pFluid, prevDays);
    const avgAlcohol = drinksAlcohol ? Math.round(wAlcohol / days * 10) / 10 : null;
    const pAvgAlcohol = drinksAlcohol ? Math.round(pAlcohol / prevDays * 10) / 10 : null;

    // Protein target from goal weight
    const goalWeight = await DB.getSetting('goalWeight');
    const proteinPerKg = (await DB.getSetting('proteinPerKg')) || 1.6;
    let proteinColor = '', proteinBg = '', proteinBadgeLabel = '';
    if (goalWeight) {
      const target = Math.round(goalWeight * proteinPerKg);
      const pct = avgProt / target;
      if (pct >= 0.9) {
        proteinColor = '#10B981'; proteinBg = 'rgba(16,185,129,0.12)'; proteinBadgeLabel = `✓ ${target}g goal`;
      } else if (pct >= 0.7) {
        proteinColor = '#F59E0B'; proteinBg = 'rgba(245,158,11,0.12)'; proteinBadgeLabel = `${target - avgProt}g below goal`;
      } else {
        proteinColor = '#EF4444'; proteinBg = 'rgba(239,68,68,0.12)'; proteinBadgeLabel = `${target - avgProt}g below goal`;
      }
    }

    return [
      { label: 'Avg Calories / Day', value: avgCal.toLocaleString(), unit: 'kcal', ...this._vsBadge(avgCal, pAvgCal) },
      { label: 'Avg Protein / Day', value: avgProt, unit: 'g', ...this._vsBadge(avgProt, pAvgProt),
        ...(proteinColor ? { color: proteinColor, bg: proteinBg, badge: proteinBadgeLabel, badgeColor: proteinColor } : {}) },
      { label: 'Avg Carbs / Day', value: avgCarbs, unit: 'g' },
      { label: 'Avg Fat / Day', value: avgFat, unit: 'g' },
      { label: 'Avg Fluid / Day', value: avgFluid.toLocaleString(), unit: 'mL', ...this._vsBadge(avgFluid, pAvgFluid) },
      { label: 'Avg Sodium / Day', value: avgSodium.toLocaleString(), unit: 'mg', ...this._vsBadge(avgSodium, pAvgSodium) },
      { label: 'Avg Caffeine / Day', value: avgCaff.toLocaleString(), unit: 'mg', ...this._vsBadge(avgCaff, pAvgCaff) },
      ...(drinksAlcohol ? [{ label: 'Avg Alcohol / Day', value: avgAlcohol.toFixed(1), unit: ' drinks', ...this._vsBadge(avgAlcohol, pAvgAlcohol) }] : [])
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
    const week = this._getWeekRange(this._weekOffset);
    const prev = this._getWeekRange(this._weekOffset + 1);
    const weekMeds = this._eventsInWeek(meds, week);
    const prevMeds = this._eventsInWeek(meds, prev);

    const weekTaken = weekMeds.filter(m => m.status === 'Taken').length;
    const weekTotal = weekMeds.length;
    const weekSkipped = weekTotal - weekTaken;
    const weekPct = weekTotal > 0 ? Math.round((weekTaken / weekTotal) * 100) : 0;
    const prevTaken = prevMeds.filter(m => m.status === 'Taken').length;
    const prevTotal = prevMeds.length;
    const prevPct = prevTotal > 0 ? Math.round((prevTaken / prevTotal) * 100) : 0;

    // Store skipped meds for the popup
    this._weekSkippedMeds = weekMeds.filter(m => m.status === 'Skipped');

    return [
      { label: 'Adherence', value: weekPct, unit: '%', ...this._vsBadge(weekPct, prevPct) },
      { label: 'Doses Taken', value: weekTaken },
      { label: 'Doses Skipped', value: weekSkipped, color: weekSkipped > 0 ? '#EF4444' : '',
        clickable: weekSkipped > 0, onclick: 'App.showSkippedMeds()' },
      { label: 'Total Doses', value: weekTotal }
    ];
  },

  showSkippedMeds() {
    const skipped = this._weekSkippedMeds || [];
    if (skipped.length === 0) return;

    // Group by date
    const grouped = {};
    skipped.forEach(m => {
      const dateKey = UI.localDateKey(m.timestamp);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(m);
    });

    // Sort dates descending (newest first)
    const sortedDates = Object.keys(grouped).sort().reverse();

    let html = '<div class="skipped-meds-list">';
    sortedDates.forEach(dateKey => {
      const d = new Date(dateKey + 'T12:00:00');
      const today = UI.todayStr();
      const yesterday = new Date(Date.now() - 86400000);
      const yesterdayStr = yesterday.getFullYear() + '-' +
        String(yesterday.getMonth() + 1).padStart(2, '0') + '-' +
        String(yesterday.getDate()).padStart(2, '0');
      let dateLabel;
      if (dateKey === today) dateLabel = 'Today';
      else if (dateKey === yesterdayStr) dateLabel = 'Yesterday';
      else dateLabel = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

      html += `<div class="skipped-date-heading">${dateLabel}</div>`;
      grouped[dateKey].forEach(m => {
        const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const period = m.timeOfDay === 'AM' ? 'Morning' : 'Evening';
        html += `<div class="skipped-med-item">
          <span class="skipped-med-icon">⊘</span>
          <div class="skipped-med-info">
            <div class="skipped-med-name">${m.medName}</div>
            <div class="skipped-med-detail">${m.dosage || ''} · ${period} · ${time}</div>
          </div>
        </div>`;
      });
    });
    html += '</div>';

    UI.openModal('Skipped Medications', html, '');
  },

  _calcVentolinStats(events) {
    const week = this._getWeekRange(this._weekOffset);
    const prev = this._getWeekRange(this._weekOffset + 1);
    const weekEvents = this._eventsInWeek(events, week);
    const prevEvents = this._eventsInWeek(events, prev);

    const weekTotal = weekEvents.length;
    const prevTotal = prevEvents.length;
    const weekPrev = weekEvents.filter(e => (e.context || '').toLowerCase().startsWith('prevent')).length;
    const weekReact = weekTotal - weekPrev;
    const prevPrevCount = prevEvents.filter(e => (e.context || '').toLowerCase().startsWith('prevent')).length;
    const prevReactCount = prevTotal - prevPrevCount;

    // Days since last use
    const sorted = [...events].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const lastUse = sorted[0];
    let daysSinceLast = 'N/A';
    if (lastUse) {
      const diff = Math.floor((Date.now() - new Date(lastUse.timestamp).getTime()) / 86400000);
      daysSinceLast = diff === 0 ? 'Today' : diff === 1 ? '1 day' : `${diff} days`;
    }

    // Days with any use this week
    const weekDaysUsed = new Set(weekEvents.map(e => UI.localDateKey(e.timestamp))).size;

    // Monthly summary (navigable)
    const rightMonth = this._getMonthRange(this._monthOffset);
    const leftMonth = this._getMonthRange(this._monthOffset + 1);
    const rightMonthEvents = this._eventsInMonth(events, rightMonth);
    const leftMonthEvents = this._eventsInMonth(events, leftMonth);
    const rightPre = rightMonthEvents.filter(e => (e.context || '').toLowerCase().startsWith('prevent')).length;
    const leftPre = leftMonthEvents.filter(e => (e.context || '').toLowerCase().startsWith('prevent')).length;
    const rightRelief = rightMonthEvents.length - rightPre;
    const leftRelief = leftMonthEvents.length - leftPre;

    const stats = [
      { label: 'Total Uses', value: weekTotal, ...this._vsBadge(weekTotal, prevTotal, true) },
      { label: 'Pre-Exercise', value: weekPrev, ...this._vsBadge(weekPrev, prevPrevCount, true) },
      { label: 'Symptom Relief', value: weekReact, ...this._vsBadge(weekReact, prevReactCount, true) },
      { label: 'Days Used', value: `${weekDaysUsed} / 7` },
      { label: 'Last Used', value: daysSinceLast }
    ];
    stats._monthlySummary = {
      rightLabel: rightMonth.label,
      leftLabel: leftMonth.label,
      rightCount: rightMonthEvents.length,
      leftCount: leftMonthEvents.length,
      rightDetail: `${rightPre} pre-exercise · ${rightRelief} symptom relief`,
      leftDetail: `${leftPre} pre-exercise · ${leftRelief} symptom relief`,
      badge: this._vsBadge(rightMonthEvents.length, leftMonthEvents.length, true),
      rightIsCurrent: this._monthOffset === 0,
      monthOffset: this._monthOffset
    };
    return stats;
  }
};

/* ---------- Startup ---------- */
document.addEventListener('DOMContentLoaded', () => App.init());
