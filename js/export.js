/* ============================================
   Heart & Health Tracker — Export Module
   CSV, PDF generation
   ============================================ */

const Export = {

  /* ---------- CSV Export for AI Analysis ---------- */
  _csv(val) {
    if (val == null || val === '') return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  },

  async generateCSV(useDemo = false) {
    if (useDemo && !Demo.isActive) {
      UI.showToast('Turn on Demo first', 'info');
      return;
    }
    const events = useDemo ? Demo.getEvents() : await DB.getAllEvents(null, 10000);
    const meds = useDemo ? Demo.getMedications() : await DB.getMedications();

    // Profile data — always include for AI context (age, BMI, meds)
    const userName = await DB.getSetting('userName') || '';
    const userDOB = await DB.getSetting('userDOB') || '';
    const userGender = await DB.getSetting('userGender') || '';
    const userHeight = await DB.getSetting('userHeight') || '';
    const goalWeight = await DB.getSetting('goalWeight') || '';
    const drinksAlcohol = await DB.getSetting('drinksAlcohol') || 'no';
    const medList = meds.map(m => `${m.name} (${m.dosage}, ${m.schedule})`).join('; ');
    const afibMeds = meds.filter(m => m.afibRelevant).map(m => m.name).join('; ');
    const bpMeds = meds.filter(m => m.bpRelevant).map(m => m.name).join('; ');
    const appVersion = (typeof App !== 'undefined' && App.APP_VERSION) ? App.APP_VERSION : '';

    const heightCm = userHeight ? parseInt(userHeight, 10) : null;
    const medLookup = meds.reduce((acc, m) => { acc[m.name] = m; return acc; }, {});

    // Pre-fetch for dynamic BP context
    const allMedEvents = events.filter(e => e.eventType === 'medication');
    const allWalkEvents = events.filter(e => e.eventType === 'walk');
    const allFoodDrinkEvents = events.filter(e => e.eventType === 'food' || e.eventType === 'drink');

    // Semantic headers — AI-friendly column names
    const headers = [
      'timestamp', 'eventType',
      'systolic_mmHg', 'diastolic_mmHg', 'heart_rate_bpm',
      'weight_kg', 'bmi',
      'steps',
      'item_name', 'quantity', 'volume_ml', 'calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'sodium_mg', 'caffeine_mg', 'alcohol_units',
      'med_name', 'med_dosage', 'med_status', 'med_time_of_day', 'med_afib_relevant', 'med_bp_relevant',
      'start_time', 'end_time', 'duration_min', 'onset_context', 'onset_notes', 'afib_episode_start_time',
      'symptoms', 'symptom_context', 'symptom_duration_min', 'stress_level', 'ventolin_context',
      'bp_med_context', 'bp_mins_since_meds', 'bp_category', 'bp_walk_context', 'bp_food_context', 'bp_caffeine_context',
      'is_during_afib', 'notes', 'was_edited'
    ];

    const rows = events.map(e => {
      const obj = {
        timestamp: e.timestamp || '',
        eventType: e.eventType || '',
        systolic_mmHg: '', diastolic_mmHg: '', heart_rate_bpm: '',
        weight_kg: '', bmi: '',
        steps: '',
        item_name: '', quantity: '', volume_ml: '', calories_kcal: '', protein_g: '', carbs_g: '', fat_g: '', sodium_mg: '', caffeine_mg: '', alcohol_units: '',
        med_name: '', med_dosage: '', med_status: '', med_time_of_day: '', med_afib_relevant: '', med_bp_relevant: '',
        start_time: '', end_time: '', duration_min: '', onset_context: '', onset_notes: '', afib_episode_start_time: '',
        symptoms: '', symptom_context: '', symptom_duration_min: '', stress_level: '', ventolin_context: '',
        bp_med_context: '', bp_mins_since_meds: '', bp_category: '', bp_walk_context: '', bp_food_context: '', bp_caffeine_context: '',
        is_during_afib: e.isDuringAFib ? 'true' : 'false',
        notes: (e.notes || '').replace(/"/g, '""'),
        was_edited: e.lastEdited ? 'true' : 'false'
      };

      switch (e.eventType) {
        case 'bp_hr':
          obj.systolic_mmHg = e.systolic || '';
          obj.diastolic_mmHg = e.diastolic || '';
          obj.heart_rate_bpm = e.heartRate || '';
          const mc = App.computeMedContext(e.timestamp, allMedEvents);
          if (mc) {
            obj.bp_med_context = mc.context || '';
            obj.bp_mins_since_meds = mc.minsSinceMeds != null ? mc.minsSinceMeds : '';
          }
          const wc = App.computeWalkContext(e.timestamp, allWalkEvents);
          if (wc) obj.bp_walk_context = wc.label;
          const fc = App.computeFoodContext(e.timestamp, allFoodDrinkEvents);
          if (fc) obj.bp_food_context = fc.label;
          const cc = App.computeCaffeineContext(e.timestamp, allFoodDrinkEvents);
          if (cc) obj.bp_caffeine_context = cc.label;
          obj.bp_category = App.classifyBpReading(e, allWalkEvents);
          break;
        case 'weight':
          obj.weight_kg = e.weight_kg || '';
          if (heightCm && heightCm > 0 && e.weight_kg) {
            obj.bmi = Math.round((e.weight_kg / Math.pow(heightCm / 100, 2)) * 10) / 10;
          }
          break;
        case 'steps':
          obj.steps = e.steps || e.step_count || '';
          break;
        case 'food':
          obj.item_name = e.foodName || '';
          obj.quantity = e.quantity || '';
          obj.calories_kcal = e.calories || '';
          obj.protein_g = e.protein_g || '';
          obj.carbs_g = e.carbs_g || '';
          obj.fat_g = e.fat_g || '';
          obj.sodium_mg = e.sodium_mg || '';
          break;
        case 'drink':
          obj.item_name = e.drinkName || '';
          obj.volume_ml = e.volume_ml || '';
          obj.calories_kcal = e.calories || '';
          obj.protein_g = e.protein_g || '';
          obj.carbs_g = e.carbs_g || '';
          obj.fat_g = e.fat_g || '';
          obj.sodium_mg = e.sodium_mg || '';
          obj.caffeine_mg = e.caffeine_mg || '';
          obj.alcohol_units = e.alcohol_units || '';
          break;
        case 'medication':
          obj.med_name = e.medName || '';
          obj.med_dosage = e.dosage || '';
          obj.med_status = e.status || '';
          obj.med_time_of_day = e.timeOfDay || '';
          const medInfo = medLookup[e.medName || ''] || {};
          obj.med_afib_relevant = medInfo.afibRelevant ? 'true' : 'false';
          obj.med_bp_relevant = medInfo.bpRelevant ? 'true' : 'false';
          break;
        case 'ventolin':
          obj.ventolin_context = e.context || '';
          break;
        case 'afib':
        case 'sleep':
        case 'walk':
          obj.start_time = e.startTime || '';
          obj.end_time = e.endTime || '';
          obj.duration_min = e.duration_min || '';
          obj.onset_context = Array.isArray(e.onsetContext) ? e.onsetContext.join('; ') : (e.onsetContext || '');
          obj.onset_notes = e.onsetNotes || '';
          break;
        case 'afib_symptom':
          obj.afib_episode_start_time = e.afibStartTime || '';
          obj.symptoms = Array.isArray(e.symptoms) ? e.symptoms.join('; ') : (e.symptoms || '');
          break;
        case 'symptom':
          obj.symptoms = Array.isArray(e.symptoms) ? e.symptoms.join('; ') : (e.symptoms || '');
          obj.symptom_context = Array.isArray(e.context) ? e.context.join('; ') : (e.context || '');
          obj.symptom_duration_min = e.duration_min != null ? e.duration_min : '';
          break;
        case 'stress':
          obj.stress_level = e.level || '';
          break;
      }

      return headers.map(h => obj[h] ?? '');
    });

    // Build CSV: profile comment block + events
    const profileLines = [
      '# Heart & Health Tracker — Export for AI Analysis',
      `# Generated: ${new Date().toISOString().slice(0, 10)}`,
      `# app_version=${appVersion}`,
      '# timezone=Australia/Brisbane (UTC+10, no DST)',
      '# PROFILE (use for age, BMI context, medication list):',
      `# name=${userName}`,
      `# dob=${userDOB}`,
      `# gender=${userGender}`,
      `# height_cm=${userHeight}`,
      `# goal_weight_kg=${goalWeight}`,
      `# drinks_alcohol=${drinksAlcohol}`,
      `# medications=${medList.replace(/"/g, '""')}`,
      `# afib_medications=${afibMeds.replace(/"/g, '""')}`,
      `# bp_medications=${bpMeds.replace(/"/g, '""')}`,
      '#',
      '# EVENTS (one row per logged entry):'
    ];

    const csvContent = [
      profileLines.join('\n'),
      headers.map(h => this._csv(h)).join(','),
      ...rows.map(r => r.map(v => this._csv(v)).join(','))
    ].join('\n');

    this._download(csvContent, `heart-tracker-${useDemo ? 'demo-' : ''}${UI.todayStr()}.csv`, 'text/csv');
  },

  /* ---------- PDF Export ---------- */
  async generatePDF() {
    if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
      UI.showToast('PDF library not loaded. Check your internet connection.', 'error');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;

    // Helper functions
    const addTitle = (text) => {
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(text, margin, y);
      y += 10;
    };

    const addSection = (text) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 179, 183);
      doc.text(text, margin, y);
      doc.setTextColor(0, 0, 0);
      y += 8;
    };

    const addText = (text, size = 10) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(size);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * (size * 0.4 + 1);
    };

    const addKeyValue = (key, value) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(key + ': ', margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), margin + doc.getTextWidth(key + ': '), y);
      y += 5;
    };

    // --- Header ---
    addTitle('Heart & Health Tracker Report');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, y);
    y += 10;

    // --- Patient Summary ---
    addSection('1. Patient Summary');
    const userName = await DB.getSetting('userName') || 'Matt Allan';
    const userDOB = await DB.getSetting('userDOB') || '1973-06-16';
    addKeyValue('Name', userName);
    addKeyValue('DOB', new Date(userDOB).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }));
    addKeyValue('Key Diagnoses', 'Paroxysmal atrial fibrillation, CAC score 1500, Sleep apnea (CPAP), Asthma');
    addKeyValue('Cardiologist', 'Dr Khaled Bhuiyan');
    addKeyValue('GP', 'Dr Raymond Collins, Smartclinics Carseldine');

    // Medications
    const meds = await DB.getMedications();
    addKeyValue('Current Medications', meds.map(m => `${m.name} (${m.dosage})`).join(', '));
    y += 5;

    // --- AFib Summary ---
    addSection('2. AFib Summary');
    const afibEvents = await DB.getAllEvents('afib', 1000);
    const completedAfib = afibEvents.filter(e => e.endTime);
    addKeyValue('Total Episodes', completedAfib.length);
    if (completedAfib.length > 0) {
      const avgDur = Math.round(completedAfib.reduce((s, e) => s + (e.duration_min || 0), 0) / completedAfib.length);
      const longest = Math.max(...completedAfib.map(e => e.duration_min || 0));
      addKeyValue('Average Duration', UI.formatDuration(avgDur));
      addKeyValue('Longest Episode', UI.formatDuration(longest));
    }
    y += 5;

    // --- BP/HR Summary ---
    addSection('3. Blood Pressure & Heart Rate');
    const bpEvents = await DB.getAllEvents('bp_hr', 1000);
    if (bpEvents.length > 0) {
      const normalBP = bpEvents.filter(e => !e.isDuringAFib);
      const afibBP = bpEvents.filter(e => e.isDuringAFib);

      if (normalBP.length > 0) {
        const avgSys = Math.round(normalBP.filter(e => e.systolic).reduce((s, e) => s + e.systolic, 0) / normalBP.filter(e => e.systolic).length);
        const avgDia = Math.round(normalBP.filter(e => e.diastolic).reduce((s, e) => s + e.diastolic, 0) / normalBP.filter(e => e.diastolic).length);
        addKeyValue('Average BP (normal sinus)', `${avgSys}/${avgDia} mmHg`);
      }

      if (afibBP.length > 0) {
        addText(`⚠ ${afibBP.length} readings were taken during active AFib episodes and may be unreliable.`);
      }

      addKeyValue('Total Readings', bpEvents.length);
    } else {
      addText('No BP/HR readings recorded.');
    }
    y += 5;

    // --- Weight ---
    addSection('4. Weight Trend');
    const weightEvents = await DB.getAllEvents('weight', 1000);
    if (weightEvents.length > 0) {
      addKeyValue('Current Weight', `${weightEvents[0].weight_kg} kg`);
      addKeyValue('Starting Weight', `${weightEvents[weightEvents.length - 1].weight_kg} kg`);
      const change = weightEvents[weightEvents.length - 1].weight_kg - weightEvents[0].weight_kg;
      addKeyValue('Change', `${change >= 0 ? '+' : ''}${Math.round(change * 10) / 10} kg`);
    }
    y += 5;

    // --- Medication Adherence ---
    addSection('5. Medication Adherence');
    const medEvents = await DB.getAllEvents('medication', 1000);
    if (medEvents.length > 0) {
      const taken = medEvents.filter(e => e.status === 'Taken').length;
      const pct = Math.round((taken / medEvents.length) * 100);
      addKeyValue('Overall Adherence', `${pct}% (${taken}/${medEvents.length} doses)`);
    }
    y += 5;

    // --- Activity ---
    addSection('6. Activity Summary');
    const walkEvents = await DB.getAllEvents('walk', 1000);
    const stepsEvents = await DB.getAllEvents('steps', 1000);
    const completedWalks = walkEvents.filter(e => e.duration_min);
    if (completedWalks.length > 0) {
      const avgWalk = Math.round(completedWalks.reduce((s, e) => s + e.duration_min, 0) / completedWalks.length);
      addKeyValue('Total Walks', completedWalks.length);
      addKeyValue('Average Walk Duration', UI.formatDuration(avgWalk));
    }
    if (stepsEvents.length > 0) {
      const avgSteps = Math.round(stepsEvents.reduce((s, e) => s + (e.steps || 0), 0) / stepsEvents.length);
      addKeyValue('Average Daily Steps', avgSteps.toLocaleString());
    }
    y += 5;

    // --- Sleep ---
    addSection('7. Sleep Summary');
    const sleepEvents = await DB.getAllEvents('sleep', 1000);
    const completedSleep = sleepEvents.filter(e => e.duration_min);
    if (completedSleep.length > 0) {
      const avgSleep = Math.round(completedSleep.reduce((s, e) => s + e.duration_min, 0) / completedSleep.length);
      addKeyValue('Average Sleep', UI.formatDuration(avgSleep));
      addKeyValue('Total Nights Logged', completedSleep.length);
    }

    // Save
    doc.save(`heart-tracker-report-${UI.todayStr()}.pdf`);
  },

  /* ---------- Helper ---------- */
  _download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
};
