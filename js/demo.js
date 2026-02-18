/* ============================================
   Heart & Health Tracker — Demo Data Module
   Generates 2 weeks of realistic data anchored to TODAY.
   Data is regenerated when demo is turned on or when date changes.
   Kept entirely in memory, never touches IndexedDB (except settings override).
   ============================================ */

const Demo = {
  isActive: false,
  _events: null,
  _idCounter: 0,
  _anchorDate: null,  // YYYY-MM-DD when data was last generated
  _savedUserName: null,
  _savedDrinksAlcohol: null,

  async toggle() {
    this.isActive = !this.isActive;
    if (this.isActive) {
      this._savedUserName = await DB.getSetting('userName');
      this._savedDrinksAlcohol = await DB.getSetting('drinksAlcohol');
      await DB.setSetting('userName', 'Alex');
      await DB.setSetting('drinksAlcohol', 'yes');
      this._events = null;
      this._idCounter = 0;
      this._anchorDate = null;
    } else {
      if (this._savedUserName !== undefined && this._savedUserName !== null) {
        await DB.setSetting('userName', this._savedUserName);
      }
      if (this._savedDrinksAlcohol !== undefined && this._savedDrinksAlcohol !== null) {
        await DB.setSetting('drinksAlcohol', this._savedDrinksAlcohol);
      }
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
    const today = new Date().toISOString().slice(0, 10);
    if (!this._events || this._anchorDate !== today) this._generate();
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

  /* Demo medications list (for AFib Insights — Sotalol marked AFib-relevant) */
  getMedications() {
    return [
      { name: 'Sotalol Hydrochloride 80mg', dosage: 'Half tablet (40mg)', schedule: 'Both', afibRelevant: true },
      { name: 'Telmisartan/Hydrochlorothiazide 80mg/25mg', dosage: '1 tablet', schedule: 'Morning', afibRelevant: false, bpRelevant: true },
      { name: 'Rilast Turbuhaler (Budesonide/Formoterol)', dosage: '1 inhalation', schedule: 'Both', afibRelevant: false },
      { name: 'Super Multi Plus (Ethical Nutrients)', dosage: '1 tablet', schedule: 'Morning', afibRelevant: false },
      { name: 'Magnesium Glycinate 400mg', dosage: '1 tablet', schedule: 'Morning', afibRelevant: false }
    ];
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
  _ts(dayOffset, hour, minute) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute || 0, 0, 0);
    return d.toISOString();
  },

  _dateStr(dayOffset) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    return d.toISOString().slice(0, 10);
  },

  _nid() {
    return `demo-${String(++this._idCounter).padStart(4, '0')}`;
  },

  /* ---------- Generate All Demo Data ---------- */
  _generate() {
    this._idCounter = 0;
    this._anchorDate = new Date().toISOString().slice(0, 10);
    const e = [];
    const ts = (d, h, min) => this._ts(d, h, min);
    const ds = (d) => this._dateStr(d);
    const nid = () => this._nid();

    // Day offsets: -13 (2 weeks ago) to 0 (today)
    // AFib events: day -10 (post-meal), day -7 (poor sleep + missed magnesium), day -3 (evening wine + stress)
    const D = {
      afib1: -10,   // Post-lunch AFib
      afib2: -7,     // Woke in AFib (poor sleep, missed magnesium)
      afib3: -3,     // Evening AFib (wine + stress)
    };

    // ============================================================
    //  SLEEP — 14 nights (night D = evening of day D → morning of day D+1)
    // ============================================================
    for (let night = -14; night <= -1; night++) {
      let duration_min = 420 + Math.floor(Math.random() * 60); // 7–8 hrs
      let notes = '';
      let isDuringAFib = false;

      if (night === D.afib2) {
        duration_min = 330;
        notes = 'Restless, woke in AFib';
        isDuringAFib = true;
      } else if (night === D.afib2 + 1) {
        duration_min = 465;
        notes = 'Recovery sleep after AFib night';
      } else if (night === D.afib3) {
        duration_min = 360;
        notes = 'AFib started during sleep';
        isDuringAFib = true;
      } else if (night === D.afib3 + 1) {
        duration_min = 390;
        notes = 'Tired after AFib episode';
      } else if (night === D.afib1) {
        duration_min = 450;
      } else if (night === D.afib1 + 1) {
        duration_min = 420;
        notes = 'Slightly short after yesterday';
      }

      const startHour = night === D.afib2 ? 0 : (22 + (night % 3 === 0 ? 1 : 0));
      const startMin = night % 2 === 0 ? 0 : 30;
      const endHour = 6 + Math.floor(duration_min / 60);
      const endMin = duration_min % 60;
      e.push({
        id: nid(), eventType: 'sleep',
        timestamp: ts(night, startHour, startMin),
        startTime: ts(night, startHour, startMin),
        endTime: ts(night + 1, endHour, endMin),
        duration_min, notes, isDuringAFib, lastEdited: null
      });
    }

    // ============================================================
    //  AFIB — 3 episodes with realistic triggers
    // ============================================================
    // Episode 1: Day -10, 2pm–8pm — post large meal (eating trigger)
    const afib1Start = ts(D.afib1, 14, 0);
    e.push({
      id: nid(), eventType: 'afib', timestamp: afib1Start,
      startTime: afib1Start, endTime: ts(D.afib1, 20, 0), duration_min: 360,
      onsetContext: ['Eating', 'Resting'], onsetNotes: 'Just finished a large ribeye lunch',
      notes: 'Started after lunch, felt fluttering', isDuringAFib: true, lastEdited: null
    });
    e.push({ id: nid(), eventType: 'afib_symptom', timestamp: ts(D.afib1, 14, 15),
      afibStartTime: afib1Start, symptoms: ['Palpitations', 'Chest Tightness'], notes: '' });
    e.push({ id: nid(), eventType: 'afib_symptom', timestamp: ts(D.afib1, 16, 0),
      afibStartTime: afib1Start, symptoms: ['Fatigue', 'Lightheaded'], notes: 'Feeling worse' });

    // Episode 2: Day -7, 11pm – Day -6, 5am — woke in AFib (sleep trigger, missed magnesium)
    const afib2Start = ts(D.afib2, 23, 0);
    e.push({
      id: nid(), eventType: 'afib', timestamp: afib2Start,
      startTime: afib2Start, endTime: ts(D.afib2 + 1, 5, 0), duration_min: 360,
      onsetContext: ['Sleeping'], onsetNotes: '',
      notes: 'Woke up with racing heart', isDuringAFib: true, lastEdited: null
    });
    e.push({ id: nid(), eventType: 'afib_symptom', timestamp: ts(D.afib2, 23, 30),
      afibStartTime: afib2Start, symptoms: ['Racing Heart', 'Anxiety'], notes: 'Woke up anxious' });

    // Episode 3: Day -3, 9pm – Day -2, 2am — evening (alcohol + stress trigger)
    const afib3Start = ts(D.afib3, 21, 0);
    e.push({
      id: nid(), eventType: 'afib', timestamp: afib3Start,
      startTime: afib3Start, endTime: ts(D.afib3 + 1, 2, 0), duration_min: 300,
      onsetContext: ['Resting', 'Stress'], onsetNotes: 'Had a glass of wine, work stress',
      notes: 'Started after dinner, felt irregular', isDuringAFib: true, lastEdited: null
    });
    e.push({ id: nid(), eventType: 'afib_symptom', timestamp: ts(D.afib3, 21, 30),
      afibStartTime: afib3Start, symptoms: ['Palpitations', 'Shortness of Breath'], notes: '' });

    // ============================================================
    //  SYMPTOMS — lightheaded, dizzy, etc. (some align with BP/AFib days)
    // ============================================================
    e.push({ id: nid(), eventType: 'symptom', timestamp: ts(D.afib1, 8, 15), symptoms: ['Lightheaded'], context: ['Standing Up'], duration_min: 0.5, notes: '' });
    e.push({ id: nid(), eventType: 'symptom', timestamp: ts(D.afib1, 13, 45), symptoms: ['Dizzy'], context: ['Resting/sitting'], duration_min: 5, notes: 'Before AFib started' });
    e.push({ id: nid(), eventType: 'symptom', timestamp: ts(-5, 7, 30), symptoms: ['Lightheaded'], context: ['Just Woke/morning'], duration_min: 0.5, notes: '' });
    e.push({ id: nid(), eventType: 'symptom', timestamp: ts(-5, 11, 0), symptoms: ['Blurred Vision'], context: ['Standing Up'], duration_min: 90, notes: '' });
    e.push({ id: nid(), eventType: 'symptom', timestamp: ts(-2, 9, 15), symptoms: ['Fatigue', 'Lightheaded'], context: ['Walking/moving'], duration_min: 5, notes: '' });
    e.push({ id: nid(), eventType: 'symptom', timestamp: ts(0, 8, 0), symptoms: ['Lightheaded'], context: ['Standing Up'], duration_min: null, notes: '' });

    // ============================================================
    //  STRESS — varied levels
    // ============================================================
    for (let day = -13; day <= 0; day++) {
      let level = 1 + (day % 3);
      if (day === D.afib1) level = 4;
      if (day === D.afib2) level = 3;
      if (day === D.afib3) level = 5;  // High stress before AFib
      if (day === D.afib1 + 1 || day === D.afib2 + 1) level = 2;
      e.push({ id: nid(), eventType: 'stress', timestamp: ts(day, 20, 30), level });
    }

    // ============================================================
    //  BLOOD PRESSURE — morning, post-walk, evening
    // ============================================================
    for (let day = -13; day <= 0; day++) {
      const isAfibDay = [D.afib1, D.afib2, D.afib3].includes(day);
      const isDayAfterAfib = [D.afib1 + 1, D.afib2 + 1, D.afib3 + 1].includes(day);

      // Morning (pre-exercise) — slightly elevated if poor sleep
      let sys = 128 + Math.floor(Math.random() * 14);
      let dia = 78 + Math.floor(Math.random() * 8);
      let hr = 65 + Math.floor(Math.random() * 10);
      if (isDayAfterAfib) { sys += 4; dia += 3; hr += 5; }
      e.push({
        id: nid(), eventType: 'bp_hr', timestamp: ts(day, 6, 45),
        systolic: sys, diastolic: dia, heartRate: hr,
        exerciseContext: null, foodContext: null, isDuringAFib: false,
        notes: 'Morning', lastEdited: null
      });

      // Post-walk (if they walked) — lower BP after exercise
      if (day !== D.afib1 + 1 && day !== D.afib2) {
        e.push({
          id: nid(), eventType: 'bp_hr', timestamp: ts(day, 7, 30),
          systolic: 118 + Math.floor(Math.random() * 8), diastolic: 74 + Math.floor(Math.random() * 6),
          heartRate: 62 + Math.floor(Math.random() * 8),
          exerciseContext: 'After Exercise', foodContext: null, isDuringAFib: false,
          notes: 'Post-walk', lastEdited: null
        });
      }

      // During AFib readings
      if (day === D.afib1) {
        e.push({
          id: nid(), eventType: 'bp_hr', timestamp: ts(day, 15, 0),
          systolic: 155, diastolic: 92, heartRate: 118,
          exerciseContext: null, foodContext: null, isDuringAFib: true,
          notes: 'During AFib', lastEdited: null
        });
      }
      if (day === D.afib2) {
        e.push({
          id: nid(), eventType: 'bp_hr', timestamp: ts(day + 1, 4, 30),
          systolic: 148, diastolic: 90, heartRate: 112,
          exerciseContext: null, foodContext: null, isDuringAFib: true,
          notes: 'Woke in AFib', lastEdited: null
        });
      }
      if (day === D.afib3) {
        e.push({
          id: nid(), eventType: 'bp_hr', timestamp: ts(day, 21, 30),
          systolic: 152, diastolic: 94, heartRate: 108,
          exerciseContext: null, foodContext: null, isDuringAFib: true,
          notes: 'During AFib', lastEdited: null
        });
      }

      // Evening — relaxed
      e.push({
        id: nid(), eventType: 'bp_hr', timestamp: ts(day, 19, 30),
        systolic: 126 + Math.floor(Math.random() * 12), diastolic: 78 + Math.floor(Math.random() * 6),
        heartRate: 64 + Math.floor(Math.random() * 8),
        exerciseContext: null, foodContext: day % 2 === 0 ? 'After Food' : null, isDuringAFib: false,
        notes: '', lastEdited: null
      });
    }

    // ============================================================
    //  WEIGHT — daily morning, downward trend with normal fluctuations
    // ============================================================
    const dailyChanges = [-0.4, +0.3, -0.5, -0.1, +0.2, -0.3, +0.4, -0.5, -0.2, +0.1, -0.4, -0.3, +0.2, -0.3]; // net ~-2.5 kg
    let w = 159.5;
    for (let day = -13; day <= 0; day++) {
      const idx = day + 13;
      if (idx > 0) w += dailyChanges[idx - 1];
      w = Math.round(w * 10) / 10;
      e.push({
        id: nid(), eventType: 'weight', timestamp: ts(day, 6, 30),
        weight_kg: w, notes: '', isDuringAFib: false, lastEdited: null
      });
    }

    // ============================================================
    //  WALKS — most mornings, 20–40 min (skip recovery days)
    // ============================================================
    for (let day = -13; day <= 0; day++) {
      if (day === D.afib1 + 1 || day === D.afib2) continue; // Recovery
      const dur = 25 + Math.floor(Math.random() * 15);
      e.push({
        id: nid(), eventType: 'walk',
        timestamp: ts(day, 6, 15), startTime: ts(day, 6, 15), endTime: ts(day, 6, 15 + dur),
        duration_min: dur, notes: '', isDuringAFib: false, lastEdited: null
      });
    }

    // ============================================================
    //  STEPS — daily
    // ============================================================
    for (let day = -13; day <= 0; day++) {
      let steps = 5000 + Math.floor(Math.random() * 2500);
      if (day === D.afib1 + 1 || day === D.afib2) steps = 2800 + Math.floor(Math.random() * 800);
      if (day === D.afib1) steps = 6500 + Math.floor(Math.random() * 1000);
      e.push({
        id: nid(), eventType: 'steps', timestamp: ts(day, 20, 0), date: ds(day),
        steps, step_count: steps, notes: '', isDuringAFib: false, lastEdited: null
      });
    }

    // ============================================================
    //  FOOD — Carnivore diet (meat, eggs, butter, bone broth)
    // ============================================================
    const carnivoreMeals = [
      { name: 'Bacon and Eggs', cal: 430, p: 35, c: 1, f: 30, na: 800, desc: '4 rashers + 3 eggs' },
      { name: 'Ribeye Steak', cal: 680, p: 65, c: 0, f: 45, na: 200, desc: '300g ribeye with butter' },
      { name: 'Beef Burger Patties', cal: 440, p: 40, c: 0, f: 30, na: 400, desc: '2 x 150g patties, no bun' },
      { name: 'Cheese Omelette', cal: 350, p: 28, c: 2, f: 25, na: 500, desc: '3 egg omelette with cheddar' },
      { name: 'Roast Chicken Quarter', cal: 260, p: 35, c: 0, f: 12, na: 250, desc: 'quarter chicken with skin' },
      { name: 'Lamb Chops', cal: 500, p: 45, c: 0, f: 35, na: 300, desc: '3 chops' },
      { name: 'Steak and Eggs', cal: 410, p: 50, c: 0, f: 22, na: 300, desc: '200g steak + 2 eggs' },
      { name: 'Bone Broth', cal: 60, p: 10, c: 0, f: 2, na: 600, desc: '1 large mug' },
      { name: 'Roast Chicken Thighs', cal: 390, p: 50, c: 0, f: 20, na: 400, desc: '4 thighs with skin' },
      { name: 'Pork Belly', cal: 620, p: 30, c: 0, f: 55, na: 350, desc: '250g slow cooked' },
      { name: 'Salmon Fillet', cal: 380, p: 42, c: 0, f: 22, na: 180, desc: '200g with butter' },
      { name: 'Beef Liver', cal: 220, p: 32, c: 4, f: 8, na: 90, desc: '100g pan fried' },
    ];
    const mealTimes = [[7, 30], [12, 30], [18, 30]];
    for (let day = -13; day <= 0; day++) {
      const mealsToday = day === 0 ? 2 : 3; // Today: breakfast + lunch only
      for (let m = 0; m < mealsToday; m++) {
        const idx = ((day + 14) * 3 + m) % carnivoreMeals.length;
        const meal = carnivoreMeals[idx];
        const [h, min] = mealTimes[m];
        const isAfib = (day === D.afib1 && m === 1) || (day === D.afib3 && m === 2);
        e.push({
          id: nid(), eventType: 'food', timestamp: ts(day, h, min),
          foodId: null, foodName: meal.name, quantity: 1, servingDescription: meal.desc,
          calories: meal.cal, protein_g: meal.p, carbs_g: meal.c, fat_g: meal.f, sodium_mg: meal.na,
          notes: '', isDuringAFib: isAfib, lastEdited: null
        });
      }
    }

    // ============================================================
    //  DRINKS — water, black coffee, bone broth, occasional wine
    // ============================================================
    for (let day = -13; day <= 0; day++) {
      const entries = [
        { n: 'Black Coffee', v: 250, h: 6, min: 30, caf: 95, cal: 5 },
        { n: 'Water', v: 250, h: 8, min: 0 },
        { n: 'Water', v: 250, h: 10, min: 30 },
        { n: 'Water', v: 250, h: 13, min: 0 },
        { n: 'Black Coffee', v: 250, h: 14, min: 30, caf: 95, cal: 5 },
        { n: 'Water', v: 250, h: 16, min: 0 },
        { n: 'Water', v: 250, h: 19, min: 0 },
      ];
      // Light drinker: 1 glass wine on days -5, -3, 0 (today lunch)
      if ([D.afib3, -5, 0].includes(day)) {
        entries.push({ n: 'Red Wine', v: 150, h: 19, min: 0, alc: 1.5, cal: 120 });
      }
      // Bone broth on some days
      if (day % 4 === 0) entries.splice(3, 0, { n: 'Bone Broth', v: 250, h: 11, min: 0, cal: 60, p: 10, f: 2, na: 600 });
      for (const d of entries) {
        if (day === 0 && d.h >= 14) continue; // Today: only morning drinks so far
        const isAfib = (day === D.afib1 && d.h >= 14) || (day === D.afib3 && d.h >= 19);
        e.push({
          id: nid(), eventType: 'drink', timestamp: ts(day, d.h, d.min || 0),
          drinkId: null, drinkName: d.n, volume_ml: d.v,
          calories: d.cal || 0, protein_g: d.p || 0, carbs_g: 0, fat_g: d.f || 0,
          sodium_mg: d.na || 0, caffeine_mg: d.caf || 0, alcohol_units: d.alc || 0,
          notes: '', isDuringAFib: !!isAfib, lastEdited: null
        });
      }
    }

    // ============================================================
    //  MEDICATIONS — AM + PM (Sotalol, Telmisartan, Rilast, Super Multi, Magnesium)
    // ============================================================
    const meds = [
      { name: 'Sotalol Hydrochloride 80mg', dosage: 'Half tablet (40mg)', ampm: 'both' },
      { name: 'Telmisartan/Hydrochlorothiazide 80mg/25mg', dosage: '1 tablet', ampm: 'am' },
      { name: 'Rilast Turbuhaler (Budesonide/Formoterol)', dosage: '1 inhalation', ampm: 'both' },
      { name: 'Super Multi Plus (Ethical Nutrients)', dosage: '1 tablet', ampm: 'am' },
      { name: 'Magnesium Glycinate 400mg', dosage: '1 tablet', ampm: 'am' },
    ];
    for (let day = -13; day <= 0; day++) {
      const amHour = 7 + (day % 3);
      const amMin = [0, 15, 30][day % 3];
      const pmHour = 20 + (day % 2);
      const pmMin = [0, 30][day % 2];
      for (const med of meds) {
        if (med.ampm === 'am' || med.ampm === 'both') {
            const skipped = (day === D.afib2 && med.name.includes('Magnesium')) || (day === D.afib2 && med.name.includes('Sotalol')); // Forgot magnesium + Sotalol (woke in AFib)
          e.push({
            id: nid(), eventType: 'medication',
            timestamp: ts(day, amHour, amMin),
            medName: med.name, dosage: med.dosage, status: skipped ? 'Skipped' : 'Taken',
            timeOfDay: 'AM', notes: skipped ? (med.name.includes('Sotalol') ? 'Forgot — woke in AFib' : 'Forgot to take') : '', isDuringAFib: false, lastEdited: null
          });
        }
      }
      if (day < 0) {
        for (const med of meds) {
          if (med.ampm === 'pm' || med.ampm === 'both') {
            const skipped = (day === D.afib1); // Forgot during AFib distraction
            e.push({
              id: nid(), eventType: 'medication',
              timestamp: ts(day, pmHour, pmMin),
              medName: med.name, dosage: med.dosage, status: skipped ? 'Skipped' : 'Taken',
              timeOfDay: 'PM', notes: skipped ? 'Forgot during AFib episode' : '', isDuringAFib: false, lastEdited: null
            });
          }
        }
      }
    }

    // ============================================================
    //  VENTOLIN — occasional use
    // ============================================================
    e.push({ id: nid(), eventType: 'ventolin', timestamp: ts(D.afib1, 14, 30),
      context: 'Reactive', notes: 'Shortness of breath during AFib', isDuringAFib: true, lastEdited: null });
    e.push({ id: nid(), eventType: 'ventolin', timestamp: ts(-4, 6, 10),
      context: 'Preventive', notes: 'Before morning walk', isDuringAFib: false, lastEdited: null });

    this._events = e;
  }
};


/* ============================================
   DataSource — Wraps DB calls, merges demo data
   Display code uses DataSource; exports use DB directly
   ============================================ */

const DataSource = {
  _localDateKey(iso) {
    if (!iso) return 'unknown';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

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
      const allDemo = Demo.getEvents();
      const todayNonSleep = allDemo.filter(e =>
        e.eventType !== 'sleep' &&
        this._localDateKey(e.timestamp) === dateStr);
      const todaySleep = allDemo.filter(e => {
        if (e.eventType !== 'sleep') return false;
        if (!e.endTime) return this._localDateKey(e.timestamp) === dateStr;
        return this._localDateKey(e.endTime) === dateStr;
      });
      return DB._buildSummaryFromEvents([...todayNonSleep, ...todaySleep]);
    }
    return DB.getDailySummary(dateStr);
  }
};
