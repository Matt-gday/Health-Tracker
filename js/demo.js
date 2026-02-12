/* ============================================
   Heart & Health Tracker — Demo Data Module
   Realistic week of test data (Feb 5-11, 2026)
   Kept entirely in memory, never touches IndexedDB
   ============================================ */

const Demo = {
  isActive: false,
  _events: null,
  _idCounter: 0,

  toggle() {
    this.isActive = !this.isActive;
    // Always regenerate fresh demo data when toggling on
    if (this.isActive) {
      this._events = null;
      this._idCounter = 0;
    }
    const btn = document.getElementById('demo-toggle');
    if (btn) {
      btn.textContent = this.isActive ? 'DEMO ON' : 'Demo';
      btn.style.background = this.isActive ? '#EF4444' : 'var(--bg-tertiary)';
      btn.style.color = this.isActive ? '#fff' : 'var(--text-secondary)';
    }
    App.renderCurrentTab();
    if (App.currentTab === 'history') App.refreshHistory();
  },

  /* Returns all demo events (or empty if off) */
  getEvents(eventType = null) {
    if (!this.isActive) return [];
    if (!this._events) this._generate();
    let events = this._events;
    if (eventType) events = events.filter(e => e.eventType === eventType);
    return events;
  },

  /* Filter demo events to a date range */
  getEventsInRange(startISO, endISO, eventType = null) {
    return this.getEvents(eventType).filter(e =>
      e.timestamp >= startISO && e.timestamp <= endISO
    );
  },

  /* Daily drink total from demo data */
  getDailyDrinkTotal(dateStr) {
    if (!this.isActive) return 0;
    return this.getEvents('drink')
      .filter(e => {
        const d = new Date(e.timestamp);
        const local = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        return local === dateStr;
      })
      .reduce((sum, e) => sum + (e.volume_ml || 0), 0);
  },

  /* ---------- Helpers ---------- */
  _ts(month, day, hour, minute) {
    return new Date(2026, month - 1, day, hour, minute || 0).toISOString();
  },

  _nid() {
    return `demo-${String(++this._idCounter).padStart(4, '0')}`;
  },

  /* ---------- Generate All Demo Data ---------- */
  _generate() {
    this._idCounter = 0;
    const e = [];
    const ts = (m, d, h, min) => this._ts(m, d, h, min);
    const nid = () => this._nid();

    // ============================================================
    //  SLEEP — 7 nights
    // ============================================================
    e.push({ id: nid(), eventType: 'sleep', timestamp: ts(2,4,23,0),
      startTime: ts(2,4,23,0), endTime: ts(2,5,6,30), duration_min: 450,
      notes: '', isDuringAFib: false, lastEdited: null });

    e.push({ id: nid(), eventType: 'sleep', timestamp: ts(2,5,22,30),
      startTime: ts(2,5,22,30), endTime: ts(2,6,6,0), duration_min: 450,
      notes: '', isDuringAFib: false, lastEdited: null });

    e.push({ id: nid(), eventType: 'sleep', timestamp: ts(2,6,23,30),
      startTime: ts(2,6,23,30), endTime: ts(2,7,7,0), duration_min: 450,
      notes: '', isDuringAFib: false, lastEdited: null });

    // Feb 7/8 — short night after AFib episode
    e.push({ id: nid(), eventType: 'sleep', timestamp: ts(2,8,0,0),
      startTime: ts(2,8,0,0), endTime: ts(2,8,5,30), duration_min: 330,
      notes: 'Restless after AFib episode earlier', isDuringAFib: false, lastEdited: null });

    e.push({ id: nid(), eventType: 'sleep', timestamp: ts(2,8,22,0),
      startTime: ts(2,8,22,0), endTime: ts(2,9,6,0), duration_min: 480,
      notes: 'Good recovery sleep', isDuringAFib: false, lastEdited: null });

    e.push({ id: nid(), eventType: 'sleep', timestamp: ts(2,9,22,30),
      startTime: ts(2,9,22,30), endTime: ts(2,10,5,45), duration_min: 435,
      notes: '', isDuringAFib: false, lastEdited: null });

    // Feb 10/11 — woke up in AFib
    e.push({ id: nid(), eventType: 'sleep', timestamp: ts(2,10,23,0),
      startTime: ts(2,10,23,0), endTime: ts(2,11,4,30), duration_min: 330,
      notes: 'Woke up in AFib, poor sleep', isDuringAFib: true, lastEdited: null });

    // ============================================================
    //  AFIB — 2 episodes, ~6 hours each
    // ============================================================
    // Episode 1: Sat Feb 7, 2pm–8pm (started after lunch)
    e.push({ id: nid(), eventType: 'afib', timestamp: ts(2,7,14,0),
      startTime: ts(2,7,14,0), endTime: ts(2,7,20,0), duration_min: 360,
      notes: 'Started after lunch, felt fluttering', isDuringAFib: true, lastEdited: null });

    // Episode 2: Tue Feb 10, 11pm – Wed Feb 11, 5am (started in sleep)
    e.push({ id: nid(), eventType: 'afib', timestamp: ts(2,10,23,0),
      startTime: ts(2,10,23,0), endTime: ts(2,11,5,0), duration_min: 360,
      notes: 'Woke up with racing heart', isDuringAFib: true, lastEdited: null });

    // ============================================================
    //  BLOOD PRESSURE / HEART RATE
    // ============================================================
    // Feb 5 — normal day
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,5,7,0),
      systolic: 138, diastolic: 85, heartRate: 72,
      exerciseContext: null, foodContext: null, isDuringAFib: false,
      notes: 'Morning reading', lastEdited: null });
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,5,20,0),
      systolic: 132, diastolic: 82, heartRate: 68,
      exerciseContext: null, foodContext: 'After Food', isDuringAFib: false,
      notes: '', lastEdited: null });

    // Feb 6
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,6,6,30),
      systolic: 135, diastolic: 84, heartRate: 70,
      exerciseContext: null, foodContext: null, isDuringAFib: false,
      notes: '', lastEdited: null });
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,6,19,0),
      systolic: 130, diastolic: 80, heartRate: 66,
      exerciseContext: null, foodContext: null, isDuringAFib: false,
      notes: '', lastEdited: null });

    // Feb 7 — AFib day (episode: 2pm–8pm)
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,7,7,30),
      systolic: 140, diastolic: 88, heartRate: 74,
      exerciseContext: null, foodContext: null, isDuringAFib: false,
      notes: 'Morning, pre-AFib', lastEdited: null });
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,7,15,0),
      systolic: 155, diastolic: 92, heartRate: 120,
      exerciseContext: null, foodContext: null, isDuringAFib: true,
      notes: 'During AFib — feeling dizzy', lastEdited: null });
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,7,18,0),
      systolic: 148, diastolic: 90, heartRate: 110,
      exerciseContext: null, foodContext: null, isDuringAFib: true,
      notes: 'Still in AFib, slightly better', lastEdited: null });
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,7,21,0),
      systolic: 135, diastolic: 84, heartRate: 78,
      exerciseContext: null, foodContext: null, isDuringAFib: false,
      notes: 'Post-AFib, feeling tired', lastEdited: null });

    // Feb 8
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,8,8,0),
      systolic: 134, diastolic: 83, heartRate: 70,
      exerciseContext: null, foodContext: null, isDuringAFib: false,
      notes: '', lastEdited: null });

    // Feb 9
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,9,6,30),
      systolic: 132, diastolic: 82, heartRate: 68,
      exerciseContext: null, foodContext: null, isDuringAFib: false,
      notes: '', lastEdited: null });
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,9,18,30),
      systolic: 118, diastolic: 76, heartRate: 64,
      exerciseContext: 'After Exercise', foodContext: null, isDuringAFib: false,
      notes: 'Great reading after walk', lastEdited: null });

    // Feb 10 — AFib starts 11pm
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,10,6,15),
      systolic: 130, diastolic: 81, heartRate: 67,
      exerciseContext: null, foodContext: null, isDuringAFib: false,
      notes: '', lastEdited: null });
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,10,19,0),
      systolic: 133, diastolic: 83, heartRate: 70,
      exerciseContext: null, foodContext: null, isDuringAFib: false,
      notes: '', lastEdited: null });
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,10,23,30),
      systolic: 152, diastolic: 95, heartRate: 115,
      exerciseContext: null, foodContext: null, isDuringAFib: true,
      notes: 'Just noticed AFib started', lastEdited: null });

    // Feb 11 (today)
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,11,5,30),
      systolic: 142, diastolic: 88, heartRate: 95,
      exerciseContext: null, foodContext: null, isDuringAFib: false,
      notes: 'Post-AFib morning reading', lastEdited: null });
    e.push({ id: nid(), eventType: 'bp_hr', timestamp: ts(2,11,8,0),
      systolic: 136, diastolic: 84, heartRate: 72,
      exerciseContext: null, foodContext: null, isDuringAFib: false,
      notes: 'Settling down', lastEdited: null });

    // ============================================================
    //  WEIGHT — daily morning, slight downward trend
    // ============================================================
    e.push({ id: nid(), eventType: 'weight', timestamp: ts(2,5,6,45), weight_kg: 158.2, notes: '', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'weight', timestamp: ts(2,6,6,30), weight_kg: 157.8, notes: '', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'weight', timestamp: ts(2,7,7,15), weight_kg: 158.0, notes: '', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'weight', timestamp: ts(2,8,7,30), weight_kg: 157.5, notes: 'After poor sleep', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'weight', timestamp: ts(2,9,6,15), weight_kg: 157.2, notes: '', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'weight', timestamp: ts(2,10,6,0), weight_kg: 156.8, notes: 'New low', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'weight', timestamp: ts(2,11,6,0), weight_kg: 157.0, notes: '', isDuringAFib: false, lastEdited: null });

    // ============================================================
    //  WALKS — most mornings, 20-40 min
    // ============================================================
    e.push({ id: nid(), eventType: 'walk', timestamp: ts(2,5,6,0), startTime: ts(2,5,6,0), endTime: ts(2,5,6,30), duration_min: 30, notes: '', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'walk', timestamp: ts(2,6,6,0), startTime: ts(2,6,6,0), endTime: ts(2,6,6,25), duration_min: 25, notes: '', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'walk', timestamp: ts(2,7,6,30), startTime: ts(2,7,6,30), endTime: ts(2,7,7,5), duration_min: 35, notes: 'Good morning walk', isDuringAFib: false, lastEdited: null });
    // Feb 8 — no walk (recovery from AFib day)
    e.push({ id: nid(), eventType: 'walk', timestamp: ts(2,9,6,15), startTime: ts(2,9,6,15), endTime: ts(2,9,6,45), duration_min: 30, notes: '', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'walk', timestamp: ts(2,10,5,45), startTime: ts(2,10,5,45), endTime: ts(2,10,6,25), duration_min: 40, notes: 'Longer walk, felt good', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'walk', timestamp: ts(2,11,7,0), startTime: ts(2,11,7,0), endTime: ts(2,11,7,25), duration_min: 25, notes: 'Shorter, tired from AFib night', isDuringAFib: false, lastEdited: null });

    // ============================================================
    //  STEPS — daily
    // ============================================================
    e.push({ id: nid(), eventType: 'steps', timestamp: ts(2,5,20,0), date: '2026-02-05', steps: 6200, notes: '', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'steps', timestamp: ts(2,6,20,0), date: '2026-02-06', steps: 5800, notes: '', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'steps', timestamp: ts(2,7,20,0), date: '2026-02-07', steps: 7100, notes: '', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'steps', timestamp: ts(2,8,20,0), date: '2026-02-08', steps: 3200, notes: 'Recovery day, minimal activity', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'steps', timestamp: ts(2,9,20,0), date: '2026-02-09', steps: 5500, notes: '', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'steps', timestamp: ts(2,10,20,0), date: '2026-02-10', steps: 6800, notes: '', isDuringAFib: false, lastEdited: null });
    e.push({ id: nid(), eventType: 'steps', timestamp: ts(2,11,12,0), date: '2026-02-11', steps: 4500, notes: '', isDuringAFib: false, lastEdited: null });

    // ============================================================
    //  FOOD — Carnivore diet
    // ============================================================
    const meals = [
      // Feb 5
      { name: 'Bacon and Eggs', t: [2,5,7,30], cal: 430, p: 35, c: 1, f: 30, na: 800, desc: '4 rashers + 3 eggs' },
      { name: 'Beef Burger Patties', t: [2,5,12,30], cal: 440, p: 40, c: 0, f: 30, na: 400, desc: '2 x 150g patties, no bun' },
      { name: 'Ribeye Steak', t: [2,5,18,30], cal: 680, p: 65, c: 0, f: 45, na: 200, desc: '300g ribeye with butter' },
      // Feb 6
      { name: 'Cheese Omelette', t: [2,6,7,0], cal: 350, p: 28, c: 2, f: 25, na: 500, desc: '3 egg omelette with cheddar' },
      { name: 'Roast Chicken Quarter', t: [2,6,12,0], cal: 260, p: 35, c: 0, f: 12, na: 250, desc: 'quarter chicken with skin' },
      { name: 'Lamb Chops', t: [2,6,18,0], cal: 500, p: 45, c: 0, f: 35, na: 300, desc: '3 chops' },
      // Feb 7 (AFib day — episode 2pm-8pm)
      { name: 'Steak and Eggs', t: [2,7,8,0], cal: 410, p: 50, c: 0, f: 22, na: 300, desc: '200g steak + 2 eggs' },
      { name: 'Bone Broth', t: [2,7,13,0], cal: 60, p: 10, c: 0, f: 2, na: 600, desc: '1 large mug' },
      { name: 'Roast Chicken Thighs', t: [2,7,19,30], cal: 390, p: 50, c: 0, f: 20, na: 400, desc: '4 thighs with skin', afib: true },
      // Feb 8
      { name: 'Bacon and Eggs', t: [2,8,8,30], cal: 430, p: 35, c: 1, f: 30, na: 800, desc: '4 rashers + 3 eggs' },
      { name: 'Beef Burger Patties', t: [2,8,13,0], cal: 440, p: 40, c: 0, f: 30, na: 400, desc: '2 x 150g patties, no bun' },
      { name: 'Pork Belly', t: [2,8,18,30], cal: 620, p: 30, c: 0, f: 55, na: 350, desc: '250g slow cooked' },
      // Feb 9
      { name: 'Steak and Eggs', t: [2,9,7,0], cal: 410, p: 50, c: 0, f: 22, na: 300, desc: '200g steak + 2 eggs' },
      { name: 'Roast Chicken Quarter', t: [2,9,12,30], cal: 260, p: 35, c: 0, f: 12, na: 250, desc: 'quarter chicken with skin' },
      { name: 'Ribeye Steak', t: [2,9,18,30], cal: 680, p: 65, c: 0, f: 45, na: 200, desc: '300g ribeye with butter' },
      // Feb 10
      { name: 'Cheese Omelette', t: [2,10,6,45], cal: 350, p: 28, c: 2, f: 25, na: 500, desc: '3 egg omelette with cheddar' },
      { name: 'Beef Burger Patties', t: [2,10,12,0], cal: 440, p: 40, c: 0, f: 30, na: 400, desc: '2 x 150g patties, no bun' },
      { name: 'Lamb Chops', t: [2,10,18,0], cal: 500, p: 45, c: 0, f: 35, na: 300, desc: '3 chops' },
      // Feb 11 (today — only breakfast and lunch so far)
      { name: 'Bacon and Eggs', t: [2,11,7,30], cal: 430, p: 35, c: 1, f: 30, na: 800, desc: '4 rashers + 3 eggs' },
      { name: 'Steak and Eggs', t: [2,11,12,0], cal: 410, p: 50, c: 0, f: 22, na: 300, desc: '200g steak + 2 eggs' },
    ];

    meals.forEach(m => {
      e.push({
        id: nid(), eventType: 'food', timestamp: ts(...m.t),
        foodId: null, foodName: m.name, quantity: 1,
        servingDescription: m.desc,
        calories: m.cal || 0, protein_g: m.p, carbs_g: m.c, fat_g: m.f, sodium_mg: m.na,
        notes: '', isDuringAFib: !!m.afib, lastEdited: null
      });
    });

    // ============================================================
    //  DRINKS — water, black coffee, occasional bone broth
    // ============================================================
    const drinks = [
      // Feb 5
      { n: 'Black Coffee', v: 250, t: [2,5,6,30] },
      { n: 'Water', v: 250, t: [2,5,8,0] },
      { n: 'Water', v: 250, t: [2,5,10,0] },
      { n: 'Water', v: 250, t: [2,5,12,0] },
      { n: 'Black Coffee', v: 250, t: [2,5,14,0] },
      { n: 'Water', v: 250, t: [2,5,16,0] },
      { n: 'Water', v: 250, t: [2,5,19,0] },
      // Feb 6
      { n: 'Black Coffee', v: 250, t: [2,6,6,0] },
      { n: 'Water', v: 250, t: [2,6,8,0] },
      { n: 'Water', v: 250, t: [2,6,10,30] },
      { n: 'Water', v: 250, t: [2,6,13,0] },
      { n: 'Water', v: 250, t: [2,6,15,30] },
      { n: 'Water', v: 250, t: [2,6,18,0] },
      // Feb 7 (AFib day)
      { n: 'Black Coffee', v: 250, t: [2,7,7,0] },
      { n: 'Water', v: 250, t: [2,7,9,0] },
      { n: 'Water', v: 250, t: [2,7,11,0] },
      { n: 'Water', v: 250, t: [2,7,15,0], afib: true },
      { n: 'Water', v: 250, t: [2,7,17,0], afib: true },
      // Feb 8
      { n: 'Black Coffee', v: 250, t: [2,8,8,0] },
      { n: 'Bone Broth', v: 250, t: [2,8,10,0] },
      { n: 'Water', v: 250, t: [2,8,11,0] },
      { n: 'Water', v: 250, t: [2,8,13,0] },
      { n: 'Water', v: 250, t: [2,8,15,0] },
      { n: 'Water', v: 250, t: [2,8,17,0] },
      { n: 'Water', v: 250, t: [2,8,19,0] },
      // Feb 9
      { n: 'Black Coffee', v: 250, t: [2,9,6,30] },
      { n: 'Water', v: 250, t: [2,9,8,30] },
      { n: 'Water', v: 250, t: [2,9,10,30] },
      { n: 'Water', v: 250, t: [2,9,13,0] },
      { n: 'Black Coffee', v: 250, t: [2,9,14,30] },
      { n: 'Water', v: 250, t: [2,9,17,0] },
      { n: 'Water', v: 250, t: [2,9,19,30] },
      // Feb 10
      { n: 'Black Coffee', v: 250, t: [2,10,6,0] },
      { n: 'Water', v: 250, t: [2,10,8,0] },
      { n: 'Water', v: 250, t: [2,10,10,0] },
      { n: 'Bone Broth', v: 250, t: [2,10,12,30] },
      { n: 'Water', v: 250, t: [2,10,14,0] },
      { n: 'Water', v: 250, t: [2,10,16,30] },
      { n: 'Water', v: 250, t: [2,10,19,0] },
      // Feb 11 (today so far)
      { n: 'Black Coffee', v: 250, t: [2,11,6,30] },
      { n: 'Water', v: 250, t: [2,11,8,0] },
      { n: 'Water', v: 250, t: [2,11,10,0] },
      { n: 'Water', v: 250, t: [2,11,12,0] },
    ];

    drinks.forEach(d => {
      const isBroth = d.n === 'Bone Broth';
      const isCoffee = d.n === 'Black Coffee';
      e.push({
        id: nid(), eventType: 'drink', timestamp: ts(...d.t),
        drinkId: null, drinkName: d.n, volume_ml: d.v,
        calories: isBroth ? 60 : (isCoffee ? 5 : 0),
        protein_g: isBroth ? 10 : 0, carbs_g: 0,
        fat_g: isBroth ? 2 : 0,
        sodium_mg: isBroth ? 600 : (isCoffee ? 5 : 0),
        caffeine_mg: isCoffee ? 95 : 0,
        notes: '', isDuringAFib: !!d.afib, lastEdited: null
      });
    });

    // ============================================================
    //  MEDICATIONS — AM + PM daily
    //  Sotalol (Both), Telmisartan (AM), Rilast (Both), Super Multi (AM)
    // ============================================================
    const meds = [
      { name: 'Sotalol Hydrochloride 80mg', dosage: 'Half tablet (40mg)', ampm: 'both' },
      { name: 'Telmisartan/Hydrochlorothiazide 80mg/25mg', dosage: '1 tablet', ampm: 'am' },
      { name: 'Rilast Turbuhaler (Budesonide/Formoterol)', dosage: '1 inhalation', ampm: 'both' },
      { name: 'Super Multi Plus (Ethical Nutrients)', dosage: '1 tablet', ampm: 'am' },
    ];

    const amTimes = { 5: [7,15], 6: [6,45], 7: [7,30], 8: [8,15], 9: [6,30], 10: [6,15], 11: [7,0] };
    const pmTimes = { 5: [20,30], 6: [20,0], 7: [20,30], 8: [21,0], 9: [20,30], 10: [20,15] };

    for (let day = 5; day <= 11; day++) {
      // AM meds
      meds.forEach(med => {
        if (med.ampm === 'am' || med.ampm === 'both') {
          e.push({
            id: nid(), eventType: 'medication',
            timestamp: ts(2, day, amTimes[day][0], amTimes[day][1]),
            medName: med.name, dosage: med.dosage,
            status: 'Taken', timeOfDay: 'AM',
            notes: '', isDuringAFib: false, lastEdited: null
          });
        }
      });

      // PM meds (not for today Feb 11 — hasn't happened yet)
      if (day <= 10) {
        const skipped = (day === 7); // Forgot during AFib distraction
        meds.forEach(med => {
          if (med.ampm === 'pm' || med.ampm === 'both') {
            e.push({
              id: nid(), eventType: 'medication',
              timestamp: ts(2, day, pmTimes[day][0], pmTimes[day][1]),
              medName: med.name, dosage: med.dosage,
              status: skipped ? 'Skipped' : 'Taken',
              timeOfDay: 'PM',
              notes: skipped ? 'Forgot during AFib episode' : '',
              isDuringAFib: false, lastEdited: null
            });
          }
        });
      }
    }

    // ============================================================
    //  VENTOLIN — 2 uses
    // ============================================================
    // Preventive before walk on Feb 10
    e.push({ id: nid(), eventType: 'ventolin', timestamp: ts(2,10,5,40),
      context: 'Preventive', notes: 'Before morning walk',
      isDuringAFib: false, lastEdited: null });

    // Reactive during AFib on Feb 7
    e.push({ id: nid(), eventType: 'ventolin', timestamp: ts(2,7,14,30),
      context: 'Reactive', notes: 'Shortness of breath during AFib',
      isDuringAFib: true, lastEdited: null });

    this._events = e;
  }
};


/* ============================================
   DataSource — Wraps DB calls, merges demo data
   Display code uses DataSource; exports use DB directly
   ============================================ */

const DataSource = {
  /* When Demo is active, return ONLY demo data (no mixing with real).
     When Demo is off, return ONLY real data from IndexedDB.
     This is a clean switch, not a merge. */

  async getAllEvents(eventType, limit) {
    if (Demo.isActive) {
      return Demo.getEvents(eventType)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, limit || 200);
    }
    return DB.getAllEvents(eventType, limit || 200);
  },

  async getEventsByTypes(types, limit) {
    if (Demo.isActive) {
      return Demo.getEvents()
        .filter(e => types.includes(e.eventType))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, limit || 200);
    }
    return DB.getEventsByTypes(types, limit || 200);
  },

  async getEventsInRange(startISO, endISO, eventType) {
    if (Demo.isActive) {
      return Demo.getEventsInRange(startISO, endISO, eventType)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
    return DB.getEventsInRange(startISO, endISO, eventType);
  },

  async getDailyDrinkTotal(dateStr) {
    if (Demo.isActive) return Demo.getDailyDrinkTotal(dateStr);
    return DB.getDailyDrinkTotal(dateStr);
  },

  async getDailyFoodTotals(dateStr) {
    if (Demo.isActive) {
      const demoFood = Demo.getEvents('food').filter(e =>
        e.timestamp >= dateStr + 'T00:00:00' && e.timestamp <= dateStr + 'T23:59:59');
      return {
        calories: demoFood.reduce((s, e) => s + (e.calories || 0), 0),
        protein_g: demoFood.reduce((s, e) => s + (e.protein_g || 0), 0),
        carbs_g: demoFood.reduce((s, e) => s + (e.carbs_g || 0), 0),
        fat_g: demoFood.reduce((s, e) => s + (e.fat_g || 0), 0),
        sodium_mg: demoFood.reduce((s, e) => s + (e.sodium_mg || 0), 0),
        count: demoFood.length
      };
    }
    return DB.getDailyFoodTotals(dateStr);
  },

  async getDailySummary(dateStr) {
    if (Demo.isActive) {
      const demoEvents = Demo.getEvents().filter(e =>
        e.timestamp >= dateStr + 'T00:00:00' && e.timestamp <= dateStr + 'T23:59:59');
      return DB._buildSummaryFromEvents(demoEvents);
    }
    return DB.getDailySummary(dateStr);
  }
};
