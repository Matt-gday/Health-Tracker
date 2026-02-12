/* ============================================
   Heart & Health Tracker — UI Rendering
   All DOM generation and UI component helpers
   ============================================ */

const UI = {

  /* ---------- Utility Helpers ---------- */
  formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
  },

  formatDateTime(iso) {
    if (!iso) return '';
    return this.formatDate(iso) + ' ' + this.formatTime(iso);
  },

  formatDuration(minutes) {
    if (!minutes && minutes !== 0) return '';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  },

  formatDurationLong(minutes) {
    if (!minutes && minutes !== 0) return '';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0 && m > 0) return `${h} hour${h > 1 ? 's' : ''} ${m} min`;
    if (h > 0) return `${h} hour${h > 1 ? 's' : ''}`;
    return `${m} min`;
  },

  /* Classify a BP reading into a category with color */
  bpCategory(sys, dia) {
    if (!sys && !dia) return { label: '', color: '', bg: '' };
    const s = sys || 0;
    const d = dia || 0;
    if (s > 180 || d > 120) return { label: 'Crisis',   color: '#991B1B', bg: '#FEE2E2' };
    if (s >= 140 || d >= 90) return { label: 'High',     color: '#DC2626', bg: '#FEE2E2' };
    if (s >= 130 || d >= 80) return { label: 'Elevated', color: '#EC4899', bg: '#FCE7F3' };
    if (s >= 120 && d < 80)  return { label: 'Elevated', color: '#EC4899', bg: '#FCE7F3' };
    if (s < 90 || d < 60)    return { label: 'Low',      color: '#3B82F6', bg: '#DBEAFE' };
    return                           { label: 'Normal',   color: '#10B981', bg: '#D1FAE5' };
  },

  todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /* Convert an ISO timestamp to a local YYYY-MM-DD string */
  localDateKey(iso) {
    if (!iso) return 'unknown';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  localISOString(date) {
    const d = date || new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  },

  /* ---------- Toast Notifications ---------- */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const iconMap = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i data-lucide="${iconMap[type] || 'info'}"></i><span>${message}</span>`;
    container.appendChild(toast);
    lucide.createIcons({ nodes: [toast] });
    setTimeout(() => toast.remove(), 3000);
  },

  /* ---------- Confirm Dialog ---------- */
  confirm(title, message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-dialog">
          <h3>${title}</h3>
          <p>${message}</p>
          <div class="confirm-actions">
            <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
            <button class="btn btn-danger" id="confirm-ok">Delete</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#confirm-cancel').onclick = () => { overlay.remove(); resolve(false); };
      overlay.querySelector('#confirm-ok').onclick = () => { overlay.remove(); resolve(true); };
    });
  },

  /* ---------- Home Screen ---------- */
  renderHome(toggleStates, dailySummary) {
    const grid = document.getElementById('home-grid');
    const buttons = [
      { id: 'afib', icon: 'heart', label: 'AFib', sublabel: toggleStates.afib ? 'Tap to Stop' : 'Tap to Start', toggleType: 'afib' },
      { id: 'bp', icon: 'activity', label: 'BP / HR', sublabel: 'Log Reading' },
      { id: 'sleep', icon: 'moon', label: 'Sleep', sublabel: toggleStates.sleep ? 'Tap to Stop' : 'Tap to Start', toggleType: 'sleep' },
      { id: 'weight', icon: 'weight', label: 'Weight', sublabel: 'Log Weight' },
      { id: 'walk', icon: 'footprints', label: 'Walk', sublabel: toggleStates.walk ? 'Tap to Stop' : 'Tap to Start', toggleType: 'walk' },
      { id: 'steps', icon: 'trending-up', label: 'Steps', sublabel: 'Log Steps' },
      { id: 'food', icon: 'utensils', label: 'Food', sublabel: 'Log Food' },
      { id: 'drink', icon: 'droplets', label: 'Drink', sublabel: 'Log Drink' },
      { id: 'medication', icon: 'pill', label: 'Meds', sublabel: 'Checklist' }
    ];

    grid.innerHTML = buttons.map(btn => {
      let activeClass = '';
      if (btn.toggleType && toggleStates[btn.toggleType]) {
        activeClass = ` toggle-active-${btn.toggleType}`;
      }
      return `
        <button class="action-btn${activeClass}" id="btn-${btn.id}" onclick="App.handleAction('${btn.id}')">
          <i data-lucide="${btn.icon}"></i>
          <span class="btn-label">${btn.toggleType && toggleStates[btn.toggleType] ? btn.label + ' Stop' : btn.label}</span>
          <span class="btn-sublabel">${btn.sublabel}</span>
        </button>`;
    }).join('');

    // Date display
    document.getElementById('home-date').textContent = new Date().toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long'
    });

    // Daily Summary
    this._renderDailySummary(dailySummary);

    lucide.createIcons();
  },

  _renderDailySummary(s) {
    let container = document.getElementById('daily-summary');
    if (!container) {
      container = document.createElement('div');
      container.id = 'daily-summary';
      container.className = 'daily-summary';
      const grid = document.getElementById('home-grid');
      grid.parentNode.insertBefore(container, grid.nextSibling);
    }

    // Build stat items — only show items that have data
    const items = [];

    // AFib
    if (s.afib.active) {
      const dur = s.afib.activeDuration;
      items.push({ icon: 'heart', label: 'AFib', value: `● Active · ${dur >= 60 ? Math.floor(dur / 60) + 'h ' + (dur % 60) + 'm' : dur + 'm'}`, cls: 'stat-afib', filter: 'afib' });
    } else if (s.afib.count > 0) {
      items.push({ icon: 'heart', label: 'AFib', value: `${s.afib.count} event${s.afib.count > 1 ? 's' : ''}`, cls: 'stat-afib', filter: 'afib' });
    }

    // BP/HR - show latest reading with category color
    if (s.bp.count > 0) {
      const bpCat = this.bpCategory(s.bp.lastSys, s.bp.lastDia);
      const bpTag = bpCat.label ? ` <span style="color:${bpCat.color};font-weight:600;font-size:var(--font-xs)">${bpCat.label}</span>` : '';
      items.push({ icon: 'activity', label: 'BP / HR', value: `${s.bp.lastSys}/${s.bp.lastDia} · ${s.bp.lastHr} bpm${bpTag}`, cls: '', filter: 'bp_hr' });
    }

    // Sleep
    if (s.sleep.totalMin > 0 || s.sleep.active) {
      const totalMin = s.sleep.totalMin + (s.sleep.activeMin || 0);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      let sleepVal = `${h}h ${m}m`;
      if (s.sleep.active) sleepVal = '● Tracking · ' + sleepVal;
      items.push({ icon: 'moon', label: 'Sleep', value: sleepVal, cls: '', filter: 'sleep' });
    }

    // Weight
    if (s.weight.latest) {
      items.push({ icon: 'weight', label: 'Weight', value: `${s.weight.latest} kg`, cls: '', filter: 'weight' });
    }

    // Walk
    if (s.walk.totalMin > 0 || s.walk.active) {
      const totalMin = s.walk.totalMin + (s.walk.activeMin || 0);
      let val = totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${totalMin}m`;
      if (s.walk.active) val = '● Active · ' + val;
      items.push({ icon: 'footprints', label: 'Walk', value: val, cls: '', filter: 'walk' });
    }

    // Steps
    if (s.steps.total > 0) {
      items.push({ icon: 'trending-up', label: 'Steps', value: s.steps.total.toLocaleString(), cls: '', filter: 'steps' });
    }

    // Food
    if (s.food.count > 0) {
      let foodVal = s.food.calories > 0 ? `${Math.round(s.food.calories)} kcal · ` : '';
      foodVal += `P:${Math.round(s.food.protein)}g · F:${Math.round(s.food.fat)}g · C:${Math.round(s.food.carbs)}g`;
      items.push({ icon: 'utensils', label: 'Food', value: foodVal, cls: '', filter: 'food' });
    }

    // Drink
    if (s.drink.totalMl > 0) {
      let val = `${s.drink.totalMl.toLocaleString()} mL`;
      if (s.drink.calories > 0) val += ` · ${Math.round(s.drink.calories)} kcal`;
      if (s.drink.caffeine > 0) val += ` · ☕ ${Math.round(s.drink.caffeine)}mg`;
      items.push({ icon: 'droplets', label: 'Drink', value: val, cls: '', filter: 'drink' });
    }

    // Medications
    if (s.meds.takenCount > 0 || s.meds.totalCount > 0) {
      items.push({ icon: 'pill', label: 'Meds', value: `${s.meds.takenCount} / ${s.meds.totalCount} taken`, cls: s.meds.takenCount >= s.meds.totalCount ? 'stat-ok' : '', filter: 'medication' });
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="summary-empty">
          <span>No data logged today — tap a button above to start</span>
        </div>`;
      return;
    }

    container.innerHTML = `
      <h3 class="summary-title">Today's Summary</h3>
      <div class="summary-grid">
        ${items.map(it => `
          <button class="summary-item ${it.cls}" onclick="App.openHistoryFiltered('${it.filter}')">
            <i data-lucide="${it.icon}"></i>
            <div class="summary-item-text">
              <span class="summary-label">${it.label}</span>
              <span class="summary-value">${it.value}</span>
            </div>
            <i data-lucide="chevron-right" class="summary-arrow"></i>
          </button>`).join('')}
      </div>`;
  },

  /* ---------- History Feed ---------- */
  renderHistory(events, activeFilters) {
    const filterContainer = document.getElementById('history-filters');
    const listContainer = document.getElementById('history-list');

    const filterTypes = [
      { key: 'all', label: 'All' },
      { key: 'afib', label: 'AFib' },
      { key: 'bp_hr', label: 'BP/HR' },
      { key: 'sleep', label: 'Sleep' },
      { key: 'weight', label: 'Weight' },
      { key: 'walk', label: 'Walk' },
      { key: 'steps', label: 'Steps' },
      { key: 'food', label: 'Food' },
      { key: 'drink', label: 'Drink' },
      { key: 'medication', label: 'Meds' },
      { key: 'ventolin', label: 'Ventolin' }
    ];

    filterContainer.innerHTML = filterTypes.map(f =>
      `<button class="filter-chip${activeFilters.includes(f.key) ? ' active' : ''}" onclick="App.toggleHistoryFilter('${f.key}')">${f.label}</button>`
    ).join('');

    if (events.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <i data-lucide="inbox"></i>
          <p>No entries yet. Start logging from the Home screen!</p>
        </div>`;
      lucide.createIcons();
      return;
    }

    // Group by local date (not UTC) so headings match the user's timezone
    const grouped = {};
    events.forEach(e => {
      const dateKey = this.localDateKey(e.timestamp);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(e);
    });

    let html = '';
    let lastWeek = null;
    const sortedKeys = Object.keys(grouped).sort().reverse();

    sortedKeys.forEach((dateKey, idx) => {
      // Week separator: insert a divider when the ISO week changes
      const thisWeek = this._isoWeek(dateKey);
      if (lastWeek !== null && thisWeek !== lastWeek) {
        html += `<div class="week-separator"></div>`;
      }
      lastWeek = thisWeek;

      const dateLabel = this._friendlyDate(dateKey);
      const singleFilter = activeFilters.length === 1 && activeFilters[0] !== 'all' ? activeFilters[0] : null;
      html += `<div class="section-header">
        <h2>${dateLabel}</h2>
        ${singleFilter ? `<button class="view-detail-link" onclick="App.openDetail('${singleFilter}')">View Details →</button>` : ''}
      </div>`;
      grouped[dateKey].forEach(event => {
        html += this._renderEventItem(event);
      });
    });

    listContainer.innerHTML = html;
    lucide.createIcons();
  },

  _friendlyDate(dateStr) {
    const today = this.todayStr();
    const yesterday = new Date(Date.now() - 86400000);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    if (dateStr === today) return 'Today';
    if (dateStr === yStr) return 'Yesterday';
    const d = new Date(dateStr + 'T12:00:00');
    const weekday = d.toLocaleDateString('en-AU', { weekday: 'long' });
    const full = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${weekday} ${full}`;
  },

  /* Returns ISO week number for a YYYY-MM-DD string */
  _isoWeek(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const yearStart = new Date(d.getFullYear(), 0, 4);
    return d.getFullYear() * 100 + Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  },

  _renderEventItem(event) {
    const config = this._eventConfig(event);
    const afibFlag = event.isDuringAFib ? '<span class="afib-flag">AFib</span>' : '';
    const editedBadge = event.lastEdited ? '<span class="edited-badge">edited</span>' : '';
    const skippedClass = (event.eventType === 'medication' && event.status === 'Skipped') ? ' entry-skipped' : '';
    const bpBadge = config.bpBadge || '';
    return `
      <div class="entry-item${skippedClass}" onclick="App.editEntry('${event.id}')">
        <div class="entry-icon ${config.iconClass}"><i data-lucide="${config.icon}"></i></div>
        <div class="entry-body">
          <div class="entry-title">${config.title} ${afibFlag}${bpBadge}</div>
          <div class="entry-subtitle">${config.subtitle}</div>
        </div>
        <div class="entry-meta">
          <div class="entry-time">${this.formatTime(event.timestamp)}</div>
          ${editedBadge}
        </div>
      </div>`;
  },

  _eventConfig(event) {
    switch (event.eventType) {
      case 'afib':
        return {
          icon: 'heart', iconClass: 'afib',
          title: event.endTime ? 'AFib Episode' : 'AFib Started',
          subtitle: event.endTime ? `Duration: ${this.formatDuration(event.duration_min)}` : 'In progress...'
        };
      case 'bp_hr': {
        const bpParts = [];
        if (event.systolic || event.diastolic) bpParts.push(`${event.systolic || '—'}/${event.diastolic || '—'} mmHg`);
        if (event.heartRate) bpParts.push(`${event.heartRate} BPM`);
        const cat = this.bpCategory(event.systolic, event.diastolic);
        return {
          icon: 'activity', iconClass: 'bp',
          title: 'Blood Pressure / HR',
          subtitle: bpParts.join('  ·  ') || 'No values recorded',
          bpBadge: cat.label ? `<span class="bp-badge" style="background:${cat.bg};color:${cat.color}">${cat.label}</span>` : ''
        };
      }
      case 'sleep':
        return {
          icon: 'moon', iconClass: 'sleep',
          title: event.endTime ? 'Sleep' : 'Sleep Started',
          subtitle: event.endTime ? `Duration: ${this.formatDuration(event.duration_min)}` : 'Sleeping...'
        };
      case 'weight':
        return {
          icon: 'weight', iconClass: 'weight',
          title: 'Weight',
          subtitle: `${event.weight_kg} kg`
        };
      case 'walk':
        return {
          icon: 'footprints', iconClass: 'walk',
          title: event.endTime ? 'Walk' : 'Walk Started',
          subtitle: event.endTime ? `Duration: ${this.formatDuration(event.duration_min)}` : 'Walking...'
        };
      case 'steps':
        return {
          icon: 'trending-up', iconClass: 'steps',
          title: 'Steps',
          subtitle: `${(event.steps || 0).toLocaleString()} steps`
        };
      case 'food':
        return {
          icon: 'utensils', iconClass: 'food',
          title: event.foodName || 'Food',
          subtitle: `${event.calories ? event.calories + ' kcal · ' : ''}P:${event.protein_g || 0}g  C:${event.carbs_g || 0}g  F:${event.fat_g || 0}g`
        };
      case 'drink':
        return {
          icon: 'droplets', iconClass: 'drink',
          title: event.drinkName || 'Drink',
          subtitle: `${event.volume_ml || 0} mL${event.calories ? ' · ' + event.calories + ' kcal' : ''}${event.caffeine_mg ? '  ☕ ' + event.caffeine_mg + 'mg' : ''}`
        };
      case 'medication':
        return {
          icon: 'pill', iconClass: event.status === 'Skipped' ? 'med-skipped' : 'med',
          title: event.medName || 'Medication',
          subtitle: `${event.dosage || ''} — ${event.status === 'Taken' ? '✓ Taken' : '✗ Skipped'} (${event.timeOfDay})`
        };
      case 'ventolin':
        return {
          icon: 'wind', iconClass: 'ventolin',
          title: 'Ventolin',
          subtitle: event.context === 'Preventive' ? 'Preventive' : 'Reactive'
        };
      default:
        return { icon: 'circle', iconClass: '', title: event.eventType, subtitle: '' };
    }
  },

  /* ---------- Modal Helpers ---------- */
  openModal(title, bodyHtml, footerHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml || '';
    document.getElementById('modal-overlay').classList.add('active');
    lucide.createIcons();
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
  },

  openFullscreenModal(title, bodyHtml, onSave) {
    document.getElementById('fullscreen-modal-title').textContent = title;
    document.getElementById('fullscreen-modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-fullscreen').classList.add('active');
    // Hide Save button when there's no save handler (list views)
    const saveBtn = document.getElementById('fullscreen-save-btn');
    if (saveBtn) saveBtn.style.display = onSave ? '' : 'none';
    App._fullscreenSaveHandler = onSave;
    lucide.createIcons();
  },

  closeFullscreenModal() {
    document.getElementById('modal-fullscreen').classList.remove('active');
    App._fullscreenSaveHandler = null;
  },

  /* ---------- BP/HR Entry Form ---------- */
  buildBpEntryForm(existingData = null) {
    const data = existingData || {};
    const ts = data.timestamp ? this.localISOString(new Date(data.timestamp)) : this.localISOString();
    return `
      <div class="input-row">
        <div class="form-group">
          <label>Systolic</label>
          <input type="number" class="form-input form-input-large" id="bp-systolic" placeholder="—" value="${data.systolic || ''}" inputmode="numeric">
        </div>
        <div class="form-group">
          <label>Diastolic</label>
          <input type="number" class="form-input form-input-large" id="bp-diastolic" placeholder="—" value="${data.diastolic || ''}" inputmode="numeric">
        </div>
        <div class="form-group">
          <label>Heart Rate</label>
          <input type="number" class="form-input form-input-large" id="bp-hr" placeholder="—" value="${data.heartRate || ''}" inputmode="numeric">
        </div>
      </div>
      <div class="form-group">
        <label>Exercise Context</label>
        <div class="toggle-group" id="bp-exercise-ctx">
          <button class="toggle-option${data.exerciseContext === 'Before Exercise' ? ' active' : ''}" data-value="Before Exercise">Before Exercise</button>
          <button class="toggle-option${data.exerciseContext === 'After Exercise' ? ' active' : ''}" data-value="After Exercise">After Exercise</button>
        </div>
      </div>
      <div class="form-group">
        <label>Food Context</label>
        <div class="toggle-group" id="bp-food-ctx">
          <button class="toggle-option${data.foodContext === 'Before Food' ? ' active' : ''}" data-value="Before Food">Before Food</button>
          <button class="toggle-option${data.foodContext === 'After Food' ? ' active' : ''}" data-value="After Food">After Food</button>
        </div>
      </div>
      <div class="form-group">
        <label>Date & Time</label>
        <input type="datetime-local" class="form-input" id="bp-timestamp" value="${ts}">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-input" id="bp-notes" placeholder="Optional notes...">${data.notes || ''}</textarea>
      </div>`;
  },

  /* ---------- Weight Entry Form ---------- */
  buildWeightEntryForm(existingData = null) {
    const data = existingData || {};
    const ts = data.timestamp ? this.localISOString(new Date(data.timestamp)) : this.localISOString();
    return `
      <div class="form-group" style="text-align:center; padding: var(--space-lg) 0;">
        <label>Weight (kg)</label>
        <input type="number" step="0.1" class="form-input form-input-large" id="weight-value" placeholder="0.0" value="${data.weight_kg || ''}" inputmode="decimal" autofocus>
      </div>
      <div class="form-group">
        <label>Date & Time</label>
        <input type="datetime-local" class="form-input" id="weight-timestamp" value="${ts}">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-input" id="weight-notes" placeholder="Optional notes...">${data.notes || ''}</textarea>
      </div>`;
  },

  /* ---------- Steps Entry Form ---------- */
  buildStepsEntryForm(existingData = null) {
    const data = existingData || {};
    const dateVal = data.date || this.todayStr();
    return `
      <div class="form-group" style="text-align:center; padding: var(--space-lg) 0;">
        <label>How many steps today?</label>
        <input type="number" class="form-input form-input-large" id="steps-value" placeholder="0" value="${data.steps || ''}" inputmode="numeric" autofocus>
      </div>
      <div class="form-group">
        <label>Date</label>
        <input type="date" class="form-input" id="steps-date" value="${dateVal}">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-input" id="steps-notes" placeholder="Optional notes...">${data.notes || ''}</textarea>
      </div>`;
  },

  /* ---------- Food Entry Form ---------- */
  buildFoodEntryForm(existingData = null) {
    const data = existingData || {};
    const ts = data.timestamp ? this.localISOString(new Date(data.timestamp)) : this.localISOString();
    return `
      <div class="form-group">
        <label>Food Name</label>
        <div class="search-wrapper">
          <i data-lucide="search"></i>
          <input type="text" class="form-input search-input" id="food-search" placeholder="Search or type new food..." value="${data.foodName || ''}" autocomplete="off">
          <div class="autocomplete-list" id="food-autocomplete"></div>
        </div>
      </div>
      <input type="hidden" id="food-library-id" value="${data.foodId || ''}">
      <div class="form-group">
        <label>Ingredients</label>
        <textarea class="form-input" id="food-ingredients" placeholder="Ingredient list (optional)...">${data.ingredients || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Serving Description</label>
        <input type="text" class="form-input" id="food-serving-desc" placeholder="e.g., quarter chicken, 1 slice" value="${data.servingDescription || ''}">
      </div>
      <div class="form-group">
        <label>Quantity (multiplier)</label>
        <input type="number" step="0.25" class="form-input" id="food-quantity" placeholder="1" value="${data.quantity || 1}" inputmode="decimal">
      </div>
      <div class="form-group">
        <label>Calories (kcal)</label>
        <input type="number" step="1" class="form-input" id="food-calories" placeholder="0" value="${data.calories || ''}" inputmode="numeric">
      </div>
      <div class="input-row">
        <div class="form-group">
          <label>Protein (g)</label>
          <input type="number" step="0.1" class="form-input" id="food-protein" placeholder="0" value="${data.protein_g || ''}" inputmode="decimal">
        </div>
        <div class="form-group">
          <label>Carbs (g)</label>
          <input type="number" step="0.1" class="form-input" id="food-carbs" placeholder="0" value="${data.carbs_g || ''}" inputmode="decimal">
        </div>
      </div>
      <div class="input-row">
        <div class="form-group">
          <label>Fat (g)</label>
          <input type="number" step="0.1" class="form-input" id="food-fat" placeholder="0" value="${data.fat_g || ''}" inputmode="decimal">
        </div>
        <div class="form-group">
          <label>Sodium (mg)</label>
          <input type="number" step="1" class="form-input" id="food-sodium" placeholder="0" value="${data.sodium_mg || ''}" inputmode="numeric">
        </div>
      </div>
      <div class="form-group">
        <label>Date & Time</label>
        <input type="datetime-local" class="form-input" id="food-timestamp" value="${ts}">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-input" id="food-notes" placeholder="Optional notes...">${data.notes || ''}</textarea>
      </div>`;
  },

  /* ---------- Drink Entry Form ---------- */
  buildDrinkEntryForm(existingData = null) {
    const data = existingData || {};
    const ts = data.timestamp ? this.localISOString(new Date(data.timestamp)) : this.localISOString();
    return `
      <div class="form-group">
        <label>Drink Name</label>
        <div class="search-wrapper">
          <i data-lucide="search"></i>
          <input type="text" class="form-input search-input" id="drink-search" placeholder="Search or type new drink..." value="${data.drinkName || ''}" autocomplete="off">
          <div class="autocomplete-list" id="drink-autocomplete"></div>
        </div>
      </div>
      <input type="hidden" id="drink-library-id" value="${data.drinkId || ''}">
      <div class="form-group">
        <label>Ingredients</label>
        <textarea class="form-input" id="drink-ingredients" placeholder="e.g. collagen, cream, salt...">${data.ingredients || ''}</textarea>
      </div>
      <div class="form-group">
        <label>Volume (mL)</label>
        <input type="number" step="25" class="form-input form-input-large" id="drink-volume" placeholder="250" value="${data.volume_ml || 250}" inputmode="numeric">
      </div>
      <div class="input-row">
        <div class="form-group">
          <label>Calories (kcal)</label>
          <input type="number" step="1" class="form-input" id="drink-calories" placeholder="0" value="${data.calories || ''}" inputmode="numeric">
        </div>
        <div class="form-group">
          <label>Caffeine (mg)</label>
          <input type="number" step="1" class="form-input" id="drink-caffeine" placeholder="0" value="${data.caffeine_mg || ''}" inputmode="numeric">
        </div>
      </div>
      <div class="input-row">
        <div class="form-group">
          <label>Protein (g)</label>
          <input type="number" step="0.1" class="form-input" id="drink-protein" placeholder="0" value="${data.protein_g || ''}" inputmode="decimal">
        </div>
        <div class="form-group">
          <label>Carbs (g)</label>
          <input type="number" step="0.1" class="form-input" id="drink-carbs" placeholder="0" value="${data.carbs_g || ''}" inputmode="decimal">
        </div>
      </div>
      <div class="input-row">
        <div class="form-group">
          <label>Fat (g)</label>
          <input type="number" step="0.1" class="form-input" id="drink-fat" placeholder="0" value="${data.fat_g || ''}" inputmode="decimal">
        </div>
        <div class="form-group">
          <label>Sodium (mg)</label>
          <input type="number" step="1" class="form-input" id="drink-sodium" placeholder="0" value="${data.sodium_mg || ''}" inputmode="numeric">
        </div>
      </div>
      <div class="form-group">
        <label>Date & Time</label>
        <input type="datetime-local" class="form-input" id="drink-timestamp" value="${ts}">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-input" id="drink-notes" placeholder="Optional notes...">${data.notes || ''}</textarea>
      </div>`;
  },

  /* ---------- Medication Checklist ---------- */
  buildMedChecklist(medications, timeOfDay) {
    if (medications.length === 0) {
      return `<div class="empty-state"><i data-lucide="pill"></i><p>No medications configured for ${timeOfDay}.<br>Add them in Settings.</p></div>`;
    }
    const listHtml = medications.map((med, i) => `
      <div class="med-item">
        <div class="med-checkbox checked" id="med-check-${i}" data-med-id="${med.id}" onclick="App.toggleMedCheck(${i})">
          <i data-lucide="check"></i>
        </div>
        <div class="med-info">
          <div class="med-name">${med.name}</div>
          <div class="med-dose">${med.dosage}</div>
        </div>
      </div>`).join('');

    return `
      <p style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-md);">
        ${timeOfDay} medications — uncheck any you missed.
      </p>
      <div class="med-list">${listHtml}</div>
      <div class="ventolin-section">
        <h3>Ventolin (as needed)</h3>
        <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-sm);">
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="App.logVentolin('Preventive')">
            <i data-lucide="shield"></i> Preventive
          </button>
          <button class="btn btn-secondary btn-sm" style="flex:1" onclick="App.logVentolin('Reactive')">
            <i data-lucide="alert-circle"></i> Reactive
          </button>
        </div>
      </div>`;
  },

  /* ---------- Retrospective Medication Form ---------- */
  buildRetrospectiveMedForm(medications, defaultTimestamp) {
    const listHtml = medications.map((med, i) => {
      const schedule = med.schedule || '';
      const scheduleTag = schedule ? `<span class="retro-med-schedule">${schedule}</span>` : '';
      return `
        <div class="med-item">
          <div class="retro-med-checkbox" id="retro-med-${i}" data-med-id="${med.id}" data-status="" onclick="App.toggleRetroMedCheck(${i})">
          </div>
          <div class="med-info">
            <div class="med-name">${med.name} ${scheduleTag}</div>
            <div class="med-dose">${med.dosage || ''}</div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="form-group">
        <label>Date & Time</label>
        <input type="datetime-local" class="form-input" id="retro-med-timestamp" value="${defaultTimestamp}">
      </div>
      <p style="font-size:var(--font-sm);color:var(--text-secondary);margin-bottom:var(--space-sm);">
        Tap once = <strong style="color:var(--accent-success)">Taken</strong> · 
        Tap again = <strong style="color:var(--accent-danger)">Skipped</strong> · 
        Tap again = unselected
      </p>
      <div class="med-list">${listHtml}</div>`;
  },

  /* ---------- Edit Entry Form (generic) ---------- */
  buildEditForm(event) {
    switch (event.eventType) {
      case 'bp_hr': return this.buildBpEntryForm(event);
      case 'weight': return this.buildWeightEntryForm(event);
      case 'steps': return this.buildStepsEntryForm(event);
      case 'food': return this.buildFoodEntryForm(event);
      case 'drink': return this.buildDrinkEntryForm(event);
      case 'afib':
      case 'sleep':
      case 'walk':
        return this._buildToggleEditForm(event);
      case 'medication':
        return this._buildMedEditForm(event);
      case 'ventolin':
        return this._buildVentolinEditForm(event);
      default:
        return '<p>Unknown event type.</p>';
    }
  },

  _buildToggleEditForm(event) {
    const typeLabel = { afib: 'AFib Episode', sleep: 'Sleep', walk: 'Walk' }[event.eventType] || event.eventType;
    const startTs = event.startTime ? this.localISOString(new Date(event.startTime)) : '';
    const endTs = event.endTime ? this.localISOString(new Date(event.endTime)) : '';
    return `
      <div class="form-group">
        <label>${typeLabel} — Start Time</label>
        <input type="datetime-local" class="form-input" id="toggle-start" value="${startTs}">
      </div>
      <div class="form-group">
        <label>End Time</label>
        <input type="datetime-local" class="form-input" id="toggle-end" value="${endTs}">
      </div>
      ${event.endTime ? `<div class="form-group">
        <label>Duration</label>
        <p style="font-size:var(--font-lg);font-weight:600">${this.formatDurationLong(event.duration_min)}</p>
      </div>` : ''}
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-input" id="toggle-notes" placeholder="Optional notes...">${event.notes || ''}</textarea>
      </div>`;
  },

  _buildMedEditForm(event) {
    const ts = event.timestamp ? this.localISOString(new Date(event.timestamp)) : '';
    return `
      <div class="form-group">
        <label>Medication</label>
        <input type="text" class="form-input" id="med-edit-name" value="${event.medName || ''}" readonly>
      </div>
      <div class="form-group">
        <label>Dosage</label>
        <input type="text" class="form-input" id="med-edit-dosage" value="${event.dosage || ''}">
      </div>
      <div class="form-group">
        <label>Status</label>
        <div class="toggle-group" id="med-edit-status">
          <button class="toggle-option${event.status === 'Taken' ? ' active' : ''}" data-value="Taken">Taken</button>
          <button class="toggle-option${event.status === 'Skipped' ? ' active' : ''}" data-value="Skipped">Skipped</button>
        </div>
      </div>
      <div class="form-group">
        <label>Date & Time</label>
        <input type="datetime-local" class="form-input" id="med-edit-timestamp" value="${ts}">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-input" id="med-edit-notes" placeholder="Optional notes...">${event.notes || ''}</textarea>
      </div>`;
  },

  _buildVentolinEditForm(event) {
    const ts = event.timestamp ? this.localISOString(new Date(event.timestamp)) : '';
    return `
      <div class="form-group">
        <label>Context</label>
        <div class="toggle-group" id="ventolin-edit-ctx">
          <button class="toggle-option${event.context === 'Preventive' ? ' active' : ''}" data-value="Preventive">Preventive</button>
          <button class="toggle-option${event.context === 'Reactive' ? ' active' : ''}" data-value="Reactive">Reactive</button>
        </div>
      </div>
      <div class="form-group">
        <label>Date & Time</label>
        <input type="datetime-local" class="form-input" id="ventolin-edit-timestamp" value="${ts}">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-input" id="ventolin-edit-notes" placeholder="Optional notes...">${event.notes || ''}</textarea>
      </div>`;
  },

  /* ---------- Settings Page ---------- */
  renderSettings() {
    const content = document.getElementById('settings-content');
    content.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-title">Health Data</div>
        <div class="settings-list">
          <div class="settings-item" onclick="App.openSettingsPage('medications')">
            <div class="settings-label"><i data-lucide="pill"></i><span>Medication List</span></div>
            <i data-lucide="chevron-right" class="chevron"></i>
          </div>
          <div class="settings-item" onclick="App.openSettingsPage('foodLibrary')">
            <div class="settings-label"><i data-lucide="utensils"></i><span>Food Library</span></div>
            <i data-lucide="chevron-right" class="chevron"></i>
          </div>
          <div class="settings-item" onclick="App.openSettingsPage('drinkLibrary')">
            <div class="settings-label"><i data-lucide="droplets"></i><span>Drink Library</span></div>
            <i data-lucide="chevron-right" class="chevron"></i>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">Profile</div>
        <div class="settings-list">
          <div class="settings-item" onclick="App.openSettingsPage('userInfo')">
            <div class="settings-label"><i data-lucide="user"></i><span>User Information</span></div>
            <i data-lucide="chevron-right" class="chevron"></i>
          </div>
          <div class="settings-item" onclick="App.openSettingsPage('goals')">
            <div class="settings-label"><i data-lucide="target"></i><span>Nutritional Goals</span></div>
            <i data-lucide="chevron-right" class="chevron"></i>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">Export & Backup</div>
        <div class="settings-list">
          <div class="settings-item" onclick="App.exportCSV()">
            <div class="settings-label"><i data-lucide="file-text"></i><span>Export for AI Analysis (CSV)</span></div>
            <i data-lucide="chevron-right" class="chevron"></i>
          </div>
          <div class="settings-item" onclick="App.exportPDF()">
            <div class="settings-label"><i data-lucide="file-text"></i><span>Cardiologist Report (PDF)</span></div>
            <i data-lucide="chevron-right" class="chevron"></i>
          </div>
          <div class="settings-item" onclick="App.exportJSON()">
            <div class="settings-label"><i data-lucide="database"></i><span>Full Backup (JSON)</span></div>
            <i data-lucide="chevron-right" class="chevron"></i>
          </div>
          <div class="settings-item" onclick="App.importJSON()">
            <div class="settings-label"><i data-lucide="upload"></i><span>Restore from Backup</span></div>
            <i data-lucide="chevron-right" class="chevron"></i>
          </div>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">App</div>
        <div class="settings-list">
          <div class="settings-item" onclick="App.openSettingsPage('notifications')">
            <div class="settings-label"><i data-lucide="bell"></i><span>Notification Preferences</span></div>
            <i data-lucide="chevron-right" class="chevron"></i>
          </div>
          <div class="settings-item" onclick="App.checkForUpdates()">
            <div class="settings-label"><i data-lucide="refresh-cw"></i><span>Check for Updates</span></div>
            <span style="font-size:var(--font-xs);color:var(--text-tertiary)">v${App.APP_VERSION}</span>
            <i data-lucide="chevron-right" class="chevron"></i>
          </div>
        </div>
      </div>
      <p style="text-align:center;color:var(--text-tertiary);font-size:var(--font-xs);padding:var(--space-lg);">
        Heart & Health Tracker v1.0.0<br>Made with care for Matt Allan
      </p>`;
    lucide.createIcons();
  },

  /* ---------- Dashboard Page ---------- */
  renderDashboard(chartData) {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
      <div class="time-range-selector" id="dashboard-range">
        <button class="time-range-btn" onclick="App.setDashboardRange('day')">Day</button>
        <button class="time-range-btn active" onclick="App.setDashboardRange('week')">Week</button>
        <button class="time-range-btn" onclick="App.setDashboardRange('month')">Month</button>
        <button class="time-range-btn" onclick="App.setDashboardRange('3months')">3M</button>
        <button class="time-range-btn" onclick="App.setDashboardRange('year')">Year</button>
        <button class="time-range-btn" onclick="App.setDashboardRange('all')">All</button>
      </div>
      <div class="chart-container" id="dashboard-chart-container">
        <canvas id="dashboard-chart"></canvas>
      </div>
      <div style="padding:0 var(--space-md) var(--space-sm);">
        <p style="font-size:var(--font-xs);color:var(--text-tertiary);">Toggle data layers (max 3-4 recommended):</p>
      </div>
      <div class="dashboard-chips" id="dashboard-chips">
        <button class="filter-chip" data-layer="afib" onclick="App.toggleDashboardLayer('afib')">AFib</button>
        <button class="filter-chip" data-layer="bp" onclick="App.toggleDashboardLayer('bp')">BP</button>
        <button class="filter-chip" data-layer="hr" onclick="App.toggleDashboardLayer('hr')">Heart Rate</button>
        <button class="filter-chip" data-layer="sleep" onclick="App.toggleDashboardLayer('sleep')">Sleep</button>
        <button class="filter-chip" data-layer="weight" onclick="App.toggleDashboardLayer('weight')">Weight</button>
        <button class="filter-chip" data-layer="walk" onclick="App.toggleDashboardLayer('walk')">Walk</button>
        <button class="filter-chip" data-layer="steps" onclick="App.toggleDashboardLayer('steps')">Steps</button>
        <button class="filter-chip" data-layer="food" onclick="App.toggleDashboardLayer('food')">Food</button>
        <button class="filter-chip" data-layer="drink" onclick="App.toggleDashboardLayer('drink')">Drink</button>
        <button class="filter-chip" data-layer="medication" onclick="App.toggleDashboardLayer('medication')">Meds</button>
        <button class="filter-chip" data-layer="ventolin" onclick="App.toggleDashboardLayer('ventolin')">Ventolin</button>
      </div>
      <div style="padding:var(--space-sm) var(--space-md);">
        <p style="font-size:var(--font-xs);color:var(--text-tertiary);font-weight:600;">Quick Presets:</p>
        <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-sm);flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" style="flex:0 0 auto" onclick="App.setDashboardPreset('afib')">AFib Analysis</button>
          <button class="btn btn-secondary btn-sm" style="flex:0 0 auto" onclick="App.setDashboardPreset('weight')">Weight Journey</button>
          <button class="btn btn-secondary btn-sm" style="flex:0 0 auto" onclick="App.setDashboardPreset('heart')">Heart Health</button>
        </div>
      </div>`;
    lucide.createIcons();
  },

  /* ---------- Detail Page Builder ---------- */
  renderDetailPage(type, stats, events) {
    const content = document.getElementById('detail-content');
    const titleEl = document.getElementById('detail-title');
    const titles = {
      afib: 'AFib', bp_hr: 'Blood Pressure / HR', sleep: 'Sleep',
      weight: 'Weight', activity: 'Activity', food: 'Food',
      drink: 'Drinks', medication: 'Medication'
    };
    titleEl.textContent = titles[type] || type;

    let html = '';

    // Stats section
    if (stats && stats.length > 0) {
      html += '<div class="stats-grid">';
      stats.forEach(s => {
        const colorStyle = s.color ? ` style="color:${s.color}"` : '';
        const badge = s.badge ? `<span class="bp-badge" style="background:${s.bg || 'transparent'};color:${s.color};font-size:var(--font-xs);margin-left:4px">${s.badge}</span>` : '';
        html += `<div class="stat-card"><div class="stat-label">${s.label}</div><div class="stat-value"${colorStyle}>${s.value} <span class="stat-unit">${s.unit || ''}</span>${badge}</div></div>`;
      });
      html += '</div>';
    }

    // BP zone legend (only for BP detail)
    if (type === 'bp_hr') {
      html += `<div class="bp-legend">
        <span class="bp-legend-item"><span class="bp-dot" style="background:#3B82F6"></span>Low</span>
        <span class="bp-legend-item"><span class="bp-dot" style="background:#10B981"></span>Normal</span>
        <span class="bp-legend-item"><span class="bp-dot" style="background:#EC4899"></span>Elevated</span>
        <span class="bp-legend-item"><span class="bp-dot" style="background:#DC2626"></span>High</span>
        <span class="bp-legend-item"><span class="bp-dot" style="background:#991B1B"></span>Crisis</span>
      </div>`;
    }

    // Chart placeholder
    html += '<div class="chart-container"><canvas id="detail-chart"></canvas></div>';

    // Events list — grouped by local date
    if (events && events.length > 0) {
      const grouped = {};
      events.forEach(e => {
        const dateKey = this.localDateKey(e.timestamp);
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(e);
      });

      const sortedKeys = Object.keys(grouped).sort().reverse();
      let lastWeek = null;

      html += '<div class="entry-list">';
      sortedKeys.forEach(dateKey => {
        const thisWeek = this._isoWeek(dateKey);
        if (lastWeek !== null && thisWeek !== lastWeek) {
          html += '<div class="week-separator"></div>';
        }
        lastWeek = thisWeek;

        html += `<div class="section-header"><h2>${this._friendlyDate(dateKey)}</h2></div>`;
        grouped[dateKey].forEach(e => {
          html += this._renderEventItem(e);
        });
      });
      html += '</div>';
    } else {
      html += '<div class="empty-state"><i data-lucide="inbox"></i><p>No data yet.</p></div>';
    }

    // Floating "Add" button
    html += `<button class="detail-fab" onclick="App.addFromDetail()" aria-label="Add entry">
      <i data-lucide="plus"></i>
    </button>`;

    content.innerHTML = html;
    lucide.createIcons();
  }
};
