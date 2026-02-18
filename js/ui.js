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
    if (s >= 130 || d >= 80) return { label: 'Elev', color: '#EC4899', bg: '#FCE7F3' };
    if (s >= 120 && d < 80)  return { label: 'Elev', color: '#EC4899', bg: '#FCE7F3' };
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

  /* Get the date key for an event — sleep uses wake time (endTime) */
  eventDateKey(event) {
    if (event.eventType === 'sleep' && event.endTime) {
      return this.localDateKey(event.endTime);
    }
    return this.localDateKey(event.timestamp);
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

  showFieldHint(text) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-info toast-hint';
    toast.innerHTML = `<span>${text}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  },

  /* ---------- Confirm Dialog ---------- */
  confirm(title, message, okLabel = 'Delete') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-dialog">
          <h3>${title}</h3>
          <p>${message}</p>
          <div class="confirm-actions">
            <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>
            <button class="btn btn-danger" id="confirm-ok">${okLabel}</button>
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
      items.push({ icon: 'heart', label: 'AFib', value: `● Active · ${dur >= 60 ? Math.floor(dur / 60) + 'h ' + (dur % 60) + 'm' : dur + 'm'} <button class="afib-symptom-btn" onclick="event.stopPropagation();App.openSymptomLog()">Log Symptoms</button>`, cls: 'stat-afib', filter: 'afib' });
    } else if (s.afib.count > 0) {
      items.push({ icon: 'heart', label: 'AFib', value: `${s.afib.count} event${s.afib.count > 1 ? 's' : ''}`, cls: 'stat-afib', filter: 'afib' });
    }

    // BP/HR - show ALL readings stacked, earliest first
    if (s.bp.count > 0 && s.bp.readings) {
      const dayMeds = s.meds?.events || [];
      const bpLines = s.bp.readings.map(r => {
        const cat = this.bpCategory(r.systolic, r.diastolic);
        const tag = cat.label ? ` <span style="color:${cat.color};font-weight:600;font-size:var(--font-xs)">${cat.label}</span>` : '';
        const mc = App.computeMedContext(r.timestamp, dayMeds);
        const shortLabel = mc ? mc.label.replace('Post-Meds', 'Post-M').replace('Pre-Meds', 'Pre-M') : '';
        const ctx = shortLabel ? ` · <span style="font-size:var(--font-xs)">${shortLabel}</span>` : '';
        const time = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `${r.systolic || '—'}/${r.diastolic || '—'} · ${r.heartRate || '—'} bpm${ctx}${tag} <span style="color:var(--text-tertiary);font-size:var(--font-xs);white-space:nowrap">${time}</span>`;
      });
      items.push({ icon: 'activity', label: 'BP / HR', value: bpLines[0], valueSub: bpLines.length > 1 ? bpLines.slice(1).join('<br>') : '', cls: '', filter: 'bp_hr' });
    } else if (s.bp.count > 0) {
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
      let weightVal = `${s.weight.latest} kg`;
      const heightCm = s.userHeight ? parseInt(s.userHeight, 10) : null;
      if (heightCm && heightCm > 0) {
        const bmi = Math.round((s.weight.latest / Math.pow(heightCm / 100, 2)) * 10) / 10;
        weightVal += ` · BMI ${bmi}`;
      }
      items.push({ icon: 'weight', label: 'Weight', value: weightVal, cls: '', filter: 'weight' });
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

    // Combined Nutrition (Food + Drink) — two-line display
    const hasFood = s.food.count > 0;
    const hasDrink = s.drink.totalMl > 0;
    if (hasFood || hasDrink) {
      const totalCal = Math.round((s.food.calories || 0) + (s.drink.calories || 0));
      const totalP = Math.round((s.food.protein || 0) + (s.drink.protein || 0));
      const totalC = Math.round((s.food.carbs || 0) + (s.drink.carbs || 0));
      const totalF = Math.round((s.food.fat || 0) + (s.drink.fat || 0));
      const totalSodium = Math.round((s.food.sodium || 0) + (s.drink.sodium || 0));
      const totalCaffeine = Math.round(s.drink.caffeine || 0);
      // Line 1: kcal, protein, fat, carbs
      let line1 = totalCal > 0 ? `🔥 ${totalCal}` : '';
      const macros = [];
      if (totalP > 0) macros.push(`🥩 ${totalP}g`);
      if (totalF > 0) macros.push(`🧈 ${totalF}g`);
      if (totalC > 0) macros.push(`🍚 ${totalC}g`);
      if (macros.length > 0) line1 += (line1 ? '  ' : '') + macros.join(' ');
      // Line 2: fluid, salt, caffeine
      const line2Parts = [];
      if (hasDrink) line2Parts.push(`💧 ${s.drink.totalMl.toLocaleString()} mL`);
      if (totalSodium > 0) line2Parts.push(`🧂 ${totalSodium} mg`);
      if (totalCaffeine > 0) line2Parts.push(`☕ ${totalCaffeine} mg`);
      if (s.drinksAlcohol && (s.drink.alcohol || 0) > 0) line2Parts.push(`🍷 ${s.drink.alcohol}`);
      const line2 = line2Parts.join('  ');
      // If no macros/cals, promote fluid line to main value
      const nutVal = line1 || line2 || '';
      const nutSub = line1 ? line2 : '';
      items.push({ icon: 'utensils', label: 'Nutrition', value: nutVal, valueSub: nutSub, cls: '', filter: 'nutrition', isDetail: true });
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
          <button class="summary-item ${it.cls}" onclick="${it.isDetail ? `App.openDetail('${it.filter}')` : `App.openHistoryFiltered('${it.filter}')`}">
            <i data-lucide="${it.icon}"></i>
            <div class="summary-values">
              <span class="summary-value">${it.value}</span>
              ${it.valueSub ? `<span class="summary-value-sub">${it.valueSub}</span>` : ''}
            </div>
            <i data-lucide="chevron-right" class="summary-arrow"></i>
          </button>`).join('')}
      </div>`;
  },

  /* ---------- History Feed ---------- */
  renderHistory(events, activeFilters, drinksAlcohol = false) {
    this._drinksAlcohol = drinksAlcohol;
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
      { key: 'symptom', label: 'Symptoms' },
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
    // Sleep events are grouped by wake time (endTime), not start time
    const grouped = {};
    events.forEach(e => {
      const dateKey = this.eventDateKey(e);
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
        ${singleFilter && idx === 0 ? `<button class="view-detail-link" onclick="App.openDetail('${singleFilter}')">Stats & Trends →</button>` : ''}
      </div>`;
      // Collect day's med events for dynamic BP med-context
      const dayMeds = grouped[dateKey].filter(e => e.eventType === 'medication');
      grouped[dateKey].forEach(event => {
        if (event.eventType === 'bp_hr') {
          event._medCtx = App.computeMedContext(event.timestamp, dayMeds);
        }
        html += this._renderEventItem(event);
      });
    });

    listContainer.innerHTML = html;
    lucide.createIcons();

    // Scroll-to-top button: show when filter pills scroll off screen
    this._setupScrollToTop();
  },

  _setupScrollToTop() {
    const filters = document.getElementById('history-filters');
    const page = document.querySelector('#page-history .page-content');
    if (!filters || !page) return;

    // Create button if it doesn't exist
    let btn = document.getElementById('scroll-top-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'scroll-top-btn';
      btn.className = 'scroll-top-btn';
      btn.innerHTML = '<i data-lucide="chevron-up"></i>';
      btn.onclick = () => page.scrollTo({ top: 0, behavior: 'smooth' });
      page.appendChild(btn);
      lucide.createIcons({ nameAttr: 'data-lucide', attrs: {}, icons: {} });
    }

    // Use IntersectionObserver on the filter chips
    if (this._scrollTopObserver) this._scrollTopObserver.disconnect();
    this._scrollTopObserver = new IntersectionObserver(
      ([entry]) => {
        btn.classList.toggle('visible', !entry.isIntersecting);
      },
      { root: page, threshold: 0 }
    );
    this._scrollTopObserver.observe(filters);
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
    const isDemo = typeof event.id === 'string' && event.id.startsWith('demo-');
    const entryItem = `
      <div class="entry-item${skippedClass}">
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
    if (isDemo) {
      return `<div class="entry-item-wrap" onclick="App.editEntry('${event.id}')">${entryItem}</div>`;
    }
    return `
      <div class="swipeable-entry" data-id="${event.id}">
        <div class="swipeable-entry-slider">
          <div class="swipeable-entry-content" onclick="App.editEntry('${event.id}')">${entryItem}</div>
          <button type="button" class="swipeable-delete" data-delete-id="${event.id}" ontouchend="event.preventDefault(); event.stopPropagation(); App.deleteEntryById('${event.id}', true)" onclick="event.stopPropagation(); App.deleteEntryById('${event.id}', true)">Delete</button>
        </div>
      </div>`;
  },

  _eventConfig(event) {
    switch (event.eventType) {
      case 'afib': {
        const durStr = event.endTime ? `Duration: ${this.formatDuration(event.duration_min)}` : 'In progress...';
        const onsetStr = event.onsetContext && event.onsetContext.length > 0 ? ` · ${event.onsetContext.join(', ')}` : '';
        return {
          icon: 'heart', iconClass: 'afib',
          title: event.endTime ? 'AFib Episode' : 'AFib Started',
          subtitle: durStr + onsetStr
        };
      }
      case 'bp_hr': {
        const bpParts = [];
        if (event.systolic || event.diastolic) bpParts.push(`${event.systolic || '—'}/${event.diastolic || '—'} mmHg`);
        if (event.heartRate) bpParts.push(`${event.heartRate} BPM`);
        if (event._medCtx) bpParts.push(event._medCtx.label);
        else if (event.medContext) bpParts.push(event.medContext); // legacy fallback
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
          subtitle: `${event.volume_ml || 0} mL${event.calories ? ' · ' + event.calories + ' kcal' : ''}${event.caffeine_mg ? '  ☕ ' + event.caffeine_mg + 'mg' : ''}${(this._drinksAlcohol && event.alcohol_units) ? '  🍷 ' + event.alcohol_units : ''}`
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
      case 'afib_symptom':
        return {
          icon: 'heart-pulse', iconClass: 'afib',
          title: 'AFib Symptoms',
          subtitle: (event.symptoms || []).join(', ') || event.notes || ''
        };
      case 'symptom':
        return {
          icon: 'stethoscope', iconClass: 'symptom',
          title: 'Symptom',
          subtitle: (() => {
          const parts = [(event.symptoms || []).join(', '), (event.context || []).join(', ')];
          const dm = event.duration_min;
          if (dm != null) {
            parts.push(dm < 1 ? 'Few seconds' : UI.formatDuration(dm));
          } else {
            parts.push('Ongoing');
          }
          return parts.filter(Boolean).join(' · ') || event.notes || '';
        })()
        };
      case 'stress':
        return {
          icon: 'brain', iconClass: 'stress',
          title: 'Stress Level',
          subtitle: `Level ${event.level}/5`
        };
      default:
        return { icon: 'circle', iconClass: '', title: event.eventType, subtitle: '' };
    }
  },

  /* ---------- Modal Helpers ---------- */
  openModal(title, bodyHtml, footerHtml, hideCloseButton = false) {
    document.getElementById('modal-title').textContent = title;
    const body = document.getElementById('modal-body');
    body.innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml || '';
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) closeBtn.style.display = hideCloseButton ? 'none' : '';
    document.getElementById('modal-overlay').classList.add('active');
    requestAnimationFrame(() => { body.scrollTop = 0; });
    lucide.createIcons();
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
  },

  openFullscreenModal(title, bodyHtml, onSave) {
    document.getElementById('fullscreen-modal-title').textContent = title;
    const body = document.getElementById('fullscreen-modal-body');
    body.innerHTML = bodyHtml;
    document.getElementById('modal-fullscreen').classList.add('active');
    // Scroll to top after DOM update
    requestAnimationFrame(() => { body.scrollTop = 0; });
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
    // When editing, stored values are totals (per-unit × quantity).
    // Divide back to per-unit so the quantity multiplier works correctly on save.
    const q = data.quantity || 1;
    const perCal = data.calories ? Math.round((data.calories / q) * 10) / 10 : '';
    const perP = data.protein_g ? Math.round((data.protein_g / q) * 10) / 10 : '';
    const perC = data.carbs_g ? Math.round((data.carbs_g / q) * 10) / 10 : '';
    const perF = data.fat_g ? Math.round((data.fat_g / q) * 10) / 10 : '';
    const perS = data.sodium_mg ? Math.round((data.sodium_mg / q) * 10) / 10 : '';
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
        <label>Calories per serving (kcal)</label>
        <input type="number" step="1" class="form-input" id="food-calories" placeholder="0" value="${perCal}" inputmode="numeric">
      </div>
      <div class="input-row">
        <div class="form-group">
          <label>Protein (g)</label>
          <input type="number" step="0.1" class="form-input" id="food-protein" placeholder="0" value="${perP}" inputmode="decimal">
        </div>
        <div class="form-group">
          <label>Carbs (g)</label>
          <input type="number" step="0.1" class="form-input" id="food-carbs" placeholder="0" value="${perC}" inputmode="decimal">
        </div>
      </div>
      <div class="input-row">
        <div class="form-group">
          <label>Fat (g)</label>
          <input type="number" step="0.1" class="form-input" id="food-fat" placeholder="0" value="${perF}" inputmode="decimal">
        </div>
        <div class="form-group">
          <label>Sodium (mg)</label>
          <input type="number" step="1" class="form-input" id="food-sodium" placeholder="0" value="${perS}" inputmode="numeric">
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
  buildDrinkEntryForm(existingData = null, drinksAlcohol = false) {
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
      ${drinksAlcohol ? `
      <div class="form-group">
        <label>Alcohol (std drinks)</label>
        <input type="number" step="0.5" class="form-input" id="drink-alcohol" placeholder="0" value="${data.alcohol_units || ''}" inputmode="decimal">
      </div>` : ''}
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
      </div>
      <div class="stress-section">
        <h3>Stress Level</h3>
        <p style="font-size:var(--font-xs);color:var(--text-tertiary);margin:4px 0 8px">${timeOfDay === 'Morning' ? 'How stressed are you this morning?' : 'How stressed have you been today?'}</p>
        <div class="stress-dots" id="stress-dots">
          ${[1,2,3,4,5].map(n => `<button class="stress-dot" data-level="${n}" onclick="App.selectStress(${n})">${n}</button>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-tertiary);margin-top:2px;padding:0 4px">
          <span>Calm</span><span>Very Stressed</span>
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
      case 'symptom':
        return this._buildSymptomEditForm(event);
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
      ${event.eventType === 'afib' ? (() => {
        const onsetOptions = ['Resting', 'Sleeping', 'Eating', 'Exercising', 'Stressed', 'Bending Over', 'Just Woke Up', 'Other'];
        const checked = event.onsetContext || [];
        return `<div class="form-group">
          <label>What were you doing?</label>
          <div class="onset-ctx-grid">
            ${onsetOptions.map(opt => `<label class="onset-ctx-option"><input type="checkbox" value="${opt}" ${checked.includes(opt) ? 'checked' : ''}><span>${opt}</span></label>`).join('')}
          </div>
        </div>`;
      })() : ''}
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

  _buildSymptomEditForm(event) {
    const symptomOpts = (typeof App !== 'undefined' ? App.SYMPTOM_OPTIONS : ['Lightheaded', 'Dizzy', 'Blurred Vision', 'Fatigue', 'Nausea', 'Other']).map(s => {
      const symptoms = event.symptoms || [];
      const isOther = s === 'Other' && symptoms.some(x => !['Lightheaded', 'Dizzy', 'Blurred Vision', 'Fatigue', 'Nausea', 'Other'].includes(x));
      const checked = symptoms.includes(s) || isOther;
      return `<label class="checkbox-label"><input type="checkbox" name="symptom" value="${s}" ${checked ? 'checked' : ''}><span>${s}</span></label>`;
    }).join('');
    const contextOpts = (typeof App !== 'undefined' ? App.CONTEXT_OPTIONS : ['Standing Up', 'Walking/moving', 'Resting/sitting', 'Lying Down', 'After Exercise', 'Just Woke/morning', 'Other']).map(c => {
      const contexts = event.context || [];
      const isOther = c === 'Other' && contexts.some(x => !['Standing Up', 'Walking/moving', 'Resting/sitting', 'Lying Down', 'After Exercise', 'Just Woke/morning', 'Other'].includes(x));
      const checked = contexts.includes(c) || isOther;
      return `<label class="checkbox-label"><input type="checkbox" name="context" value="${c}" ${checked ? 'checked' : ''}><span>${c}</span></label>`;
    }).join('');
    const otherSymptom = (event.symptoms || []).find(s => !['Lightheaded', 'Dizzy', 'Blurred Vision', 'Fatigue', 'Nausea', 'Other'].includes(s)) || '';
    const otherContext = (event.context || []).find(c => !['Standing Up', 'Walking/moving', 'Resting/sitting', 'Lying Down', 'After Exercise', 'Just Woke/morning', 'Other'].includes(c)) || '';
    const ts = event.timestamp ? this.localISOString(new Date(event.timestamp)) : this.localISOString();
    const dm = event.duration_min;
    let durationType = 'ongoing';
    let durationTimeVal = '01:00';
    if (dm != null) {
      if (dm <= 0.75) durationType = 'seconds';
      else if (dm >= 4 && dm <= 6) durationType = 'minutes';
      else {
        durationType = 'longer';
        const h = Math.floor(dm / 60);
        const m = Math.round(dm % 60);
        durationTimeVal = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }
    return `
      <div class="form-group">
        <label>Symptom</label>
        <div class="checkbox-group">${symptomOpts}</div>
        <input type="text" class="form-input" id="symptom-edit-other-symptom" placeholder="Other (if selected)" value="${otherSymptom}" style="margin-top:6px;${otherSymptom ? '' : 'display:none'}">
      </div>
      <div class="form-group">
        <label>What were you doing?</label>
        <div class="checkbox-group">${contextOpts}</div>
        <input type="text" class="form-input" id="symptom-edit-other-context" placeholder="Other (if selected)" value="${otherContext}" style="margin-top:6px;${otherContext ? '' : 'display:none'}">
      </div>
      <div class="form-group">
        <label>How long did it last?</label>
        <div class="toggle-group" id="symptom-edit-duration-type">
          <button class="toggle-option${durationType === 'seconds' ? ' active' : ''}" data-value="seconds">Few seconds</button>
          <button class="toggle-option${durationType === 'minutes' ? ' active' : ''}" data-value="minutes">Few minutes</button>
          <button class="toggle-option${durationType === 'longer' ? ' active' : ''}" data-value="longer">Longer</button>
          <button class="toggle-option${durationType === 'ongoing' ? ' active' : ''}" data-value="ongoing">Ongoing</button>
        </div>
        <div id="symptom-edit-duration-longer" style="display:${durationType === 'longer' ? 'block' : 'none'};margin-top:8px">
          <input type="time" class="form-input" id="symptom-edit-duration-time" value="${durationTimeVal}" step="60">
          <span style="font-size:var(--font-sm);color:var(--text-tertiary);margin-left:8px">(hours:minutes)</span>
        </div>
      </div>
      <div class="form-group">
        <label>Date & Time</label>
        <input type="datetime-local" class="form-input" id="symptom-edit-timestamp" value="${ts}">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-input" id="symptom-edit-notes" placeholder="Optional...">${event.notes || ''}</textarea>
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
            <div class="settings-label"><i data-lucide="user"></i><span>Personal Information</span></div>
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
      <div class="settings-section settings-danger">
        <div class="settings-section-title">Danger Zone</div>
        <div class="settings-list">
          <div class="settings-item settings-item-danger" onclick="App.confirmDeleteAllData()">
            <div class="settings-label"><i data-lucide="trash-2"></i><span>Delete All Data</span></div>
            <i data-lucide="chevron-right" class="chevron"></i>
          </div>
        </div>
      </div>
      <p style="text-align:center;color:var(--text-tertiary);font-size:var(--font-xs);padding:var(--space-lg);">
        Heart & Health Tracker v${App.APP_VERSION}<br>Made with care for Matt Allan
      </p>`;
    lucide.createIcons();
  },

  /* ---------- AFib Insights Page (rendered by App.renderAfibInsights) ---------- */

  /* ---------- Detail Page Stat Helpers ---------- */
  _buildStatCardHtml(s) {
    const colorStyle = s.color ? ` style="color:${s.color}"` : '';
    const bColor = s.badgeColor || s.color || '';
    const badge = s.badge ? `<span class="bp-badge" style="background:${s.bg || 'transparent'};color:${bColor};font-size:var(--font-xs);margin-left:4px">${s.badge}</span>` : '';
    const clickAttr = s.clickable && s.onclick ? ` onclick="${s.onclick}" style="cursor:pointer"` : '';
    const clickHint = s.clickable ? ' <span style="font-size:var(--font-xs);opacity:0.6">tap to view</span>' : '';
    return `<div class="stat-card"${clickAttr}><div class="stat-label">${s.label}</div><div class="stat-value"${colorStyle}>${s.value} <span class="stat-unit">${s.unit || ''}</span>${badge}${clickHint}</div></div>`;
  },

  _buildStatsHtml(stats) {
    if (!stats || stats.length === 0) return '';
    let html = '<div class="stats-grid" id="stats-grid">';
    stats.forEach(s => { html += this._buildStatCardHtml(s); });
    html += '</div>';
    // Monthly summary (for afib, ventolin)
    if (stats._monthlySummary) {
      html += this._buildMonthlySummaryHtml(stats._monthlySummary);
    }
    return html;
  },

  _buildMonthlySummaryHtml(m) {
    const badge = m.badge && m.badge.badge
      ? `<span class="monthly-badge" style="background:${m.badge.bg || 'transparent'};color:${m.badge.badgeColor || ''}">${m.badge.badge}</span>`
      : '';
    const rightBold = m.rightIsCurrent ? ' monthly-current' : '';
    const disableRight = m.monthOffset === 0 ? ' disabled' : '';
    return `<div class="monthly-summary" id="monthly-summary">
      <div class="monthly-header">
        <button class="month-arrow" onclick="App.shiftMonth(1)">‹</button>
        <span class="monthly-summary-title">Monthly Comparison</span>
        <button class="month-arrow"${disableRight} onclick="App.shiftMonth(-1)">›</button>
      </div>
      <div class="monthly-row">
        <div class="monthly-cell">
          <div class="monthly-label">${m.leftLabel}</div>
          <div class="monthly-value">${m.leftCount}</div>
          ${m.leftDetail ? `<div class="monthly-detail">${m.leftDetail}</div>` : ''}
          ${m.leftDur ? `<div class="monthly-detail">${m.leftDur} total</div>` : ''}
        </div>
        <div class="monthly-divider"></div>
        <div class="monthly-cell">
          <div class="monthly-label${rightBold}">${m.rightLabel}</div>
          <div class="monthly-value">${m.rightCount} ${badge}</div>
          ${m.rightDetail ? `<div class="monthly-detail">${m.rightDetail}</div>` : ''}
          ${m.rightDur ? `<div class="monthly-detail">${m.rightDur} total</div>` : ''}
        </div>
      </div>
    </div>`;
  },

  updateWeekStats(stats, weekRange, weekOffset) {
    const label = document.getElementById('week-range-label');
    if (label) label.textContent = weekRange.label;
    const rightArrow = document.getElementById('week-arrow-right');
    if (rightArrow) rightArrow.disabled = weekOffset === 0;
    const grid = document.getElementById('stats-grid');
    if (grid) {
      let html = '';
      stats.forEach(s => { html += this._buildStatCardHtml(s); });
      grid.innerHTML = html;
    }
    // Update monthly summary if present
    const monthEl = document.getElementById('monthly-summary');
    if (stats._monthlySummary) {
      if (monthEl) {
        monthEl.outerHTML = this._buildMonthlySummaryHtml(stats._monthlySummary);
      }
    } else if (monthEl) {
      monthEl.remove();
    }
  },

  /* ---------- Detail Page Builder ---------- */
  renderDetailPage(type, stats, events, weekRange = null, weekOffset = 0, drinksAlcohol = false, symptomEventsForBp = []) {
    this._drinksAlcohol = drinksAlcohol;
    const content = document.getElementById('detail-content');
    const titleEl = document.getElementById('detail-title');
    const titles = {
      afib: 'AFib', bp_hr: 'Blood Pressure / HR', sleep: 'Sleep',
      weight: 'Weight', activity: 'Activity', food: 'Food',
      symptom: 'Symptoms',
      drink: 'Drinks', nutrition: 'Nutrition', medication: 'Medication',
      ventolin: 'Ventolin'
    };
    titleEl.textContent = titles[type] || type;

    let html = '';

    // Week navigator (for types that support it)
    if (weekRange) {
      html += `<div class="week-navigator" id="week-nav">
        <button class="week-arrow" onclick="App.shiftWeek(1)">‹</button>
        <span class="week-range-label" id="week-range-label">${weekRange.label}</span>
        <button class="week-arrow" id="week-arrow-right" onclick="App.shiftWeek(-1)" ${weekOffset === 0 ? 'disabled' : ''}>›</button>
      </div>`;
    }

    // Stats section
    html += this._buildStatsHtml(stats);

    // BP zone legend (only for BP detail)
    if (type === 'bp_hr') {
      html += `<div class="bp-legend">
        <span class="bp-legend-item"><span class="bp-dot" style="background:#3B82F6"></span>Low</span>
        <span class="bp-legend-item"><span class="bp-dot" style="background:#10B981"></span>Normal</span>
        <span class="bp-legend-item"><span class="bp-dot" style="background:#EC4899"></span>Elev</span>
        <span class="bp-legend-item"><span class="bp-dot" style="background:#DC2626"></span>High</span>
        <span class="bp-legend-item"><span class="bp-dot" style="background:#991B1B"></span>Crisis</span>
        <span class="bp-legend-item"><span class="bp-dot" style="background:transparent;border:2px solid #F59E0B;box-sizing:border-box"></span>AFib</span>
      </div>`;

      // BP context selector (Morning / Post-Walk / Evening) — text toggle
      const bpCtx = App._bpContext || 'morning';
      html += `<div class="bp-context-filters">
        <button class="${bpCtx === 'morning' ? 'active' : ''}" data-ctx="morning" onclick="App.setBpContext('morning')">Morning</button>
        <button class="${bpCtx === 'post-walk' ? 'active' : ''}" data-ctx="post-walk" onclick="App.setBpContext('post-walk')">Post-Walk</button>
        <button class="${bpCtx === 'evening' ? 'active' : ''}" data-ctx="evening" onclick="App.setBpContext('evening')">Evening</button>
      </div>`;
    }

    // Time range filter for all chart types
    const chartTypes = ['afib', 'bp_hr', 'sleep', 'weight', 'activity', 'nutrition', 'medication', 'symptom', 'ventolin'];
    if (chartTypes.includes(type)) {
      const ranges = [
        { key: 'week', label: '7 Days' },
        { key: 'month', label: '30 Days' },
        { key: '3month', label: '3 Months' },
        { key: 'all', label: 'All Time' }
      ];
      const active = Charts._chartRanges[type] || 'month';
      html += `<div class="chart-range-filters">${ranges.map(r =>
        `<button class="filter-chip${r.key === active ? ' active' : ''}" onclick="App.setChartRange('${type}','${r.key}')">${r.label}</button>`
      ).join('')}</div>`;
    }

    // Chart placeholder
    html += '<div class="chart-container"><canvas id="detail-chart"></canvas></div>';

    // Symptom-BP correlation (only for BP detail)
    if (type === 'bp_hr' && symptomEventsForBp && symptomEventsForBp.length > 0) {
      const bpByDay = {};
      events.forEach(e => {
        const dk = this.localDateKey(e.timestamp);
        if (!bpByDay[dk]) bpByDay[dk] = [];
        bpByDay[dk].push(e);
      });
      const symptomDays = new Set(symptomEventsForBp.map(e => this.localDateKey(e.timestamp)));
      const daysWithBoth = [...symptomDays].filter(dk => bpByDay[dk] && bpByDay[dk].length > 0);
      if (daysWithBoth.length > 0) {
        let sysWith = 0, diaWith = 0, nSysWith = 0, nDiaWith = 0, nWith = 0;
        let sysWithout = 0, diaWithout = 0, nSysWithout = 0, nDiaWithout = 0, nWithout = 0;
        Object.entries(bpByDay).forEach(([dk, bps]) => {
          const withSys = bps.filter(b => b.systolic);
          const withDia = bps.filter(b => b.diastolic);
          const avgSys = withSys.length ? withSys.reduce((s, b) => s + b.systolic, 0) / withSys.length : null;
          const avgDia = withDia.length ? withDia.reduce((s, b) => s + b.diastolic, 0) / withDia.length : null;
          if (symptomDays.has(dk)) {
            if (avgSys != null) { sysWith += avgSys; nSysWith++; }
            if (avgDia != null) { diaWith += avgDia; nDiaWith++; }
            nWith++;
          } else {
            if (avgSys != null) { sysWithout += avgSys; nSysWithout++; }
            if (avgDia != null) { diaWithout += avgDia; nDiaWithout++; }
            nWithout++;
          }
        });
        const sysWithAvg = nSysWith > 0 ? Math.round(sysWith / nSysWith) : '—';
        const diaWithAvg = nDiaWith > 0 ? Math.round(diaWith / nDiaWith) : '—';
        const sysWithoutAvg = nSysWithout > 0 ? Math.round(sysWithout / nSysWithout) : '—';
        const diaWithoutAvg = nDiaWithout > 0 ? Math.round(diaWithout / nDiaWithout) : '—';
        html += `<div class="symptom-bp-section">
          <div class="section-title" style="margin-top:var(--space-md)">Symptom & BP</div>
          <p style="font-size:var(--font-sm);color:var(--text-tertiary);margin-bottom:var(--space-sm)">Days when you logged both symptoms and BP</p>
          <div class="symptom-bp-grid">
            <div class="symptom-bp-card">
              <div class="symptom-bp-label">On symptom days (${nWith})</div>
              <div class="symptom-bp-value">${sysWithAvg}/${diaWithAvg}</div>
            </div>
            <div class="symptom-bp-card">
              <div class="symptom-bp-label">Other days (${nWithout})</div>
              <div class="symptom-bp-value">${sysWithoutAvg}/${diaWithoutAvg}</div>
            </div>
          </div>
        </div>`;
      }
    }

    // Events list — grouped by local date (sleep uses wake time)
    if (events && events.length > 0) {
      const grouped = {};
      events.forEach(e => {
        const dateKey = this.eventDateKey(e);
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
        // Enrich BP events with dynamic med context
        const dayMeds = grouped[dateKey].filter(ev => ev.eventType === 'medication');
        grouped[dateKey].forEach(e => {
          if (e.eventType === 'bp_hr') {
            e._medCtx = App.computeMedContext(e.timestamp, dayMeds);
          }
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
