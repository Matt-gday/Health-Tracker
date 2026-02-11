/* ============================================
   Heart & Health Tracker — Export Module
   CSV, PDF generation
   ============================================ */

const Export = {

  /* ---------- CSV Export ---------- */
  async generateCSV() {
    const events = await DB.getAllEvents(null, 10000);
    if (events.length === 0) {
      UI.showToast('No data to export', 'info');
      return;
    }

    const headers = [
      'timestamp', 'eventType', 'value1', 'value2', 'value3', 'value4', 'value5',
      'name', 'quantity', 'context1', 'context2', 'isDuringAFib',
      'duration_min', 'notes', 'wasEdited'
    ];

    const rows = events.map(e => {
      let value1 = '', value2 = '', value3 = '', value4 = '', value5 = '';
      let name = '', quantity = '', context1 = '', context2 = '';

      switch (e.eventType) {
        case 'bp_hr':
          value1 = e.systolic || '';
          value2 = e.diastolic || '';
          value3 = e.heartRate || '';
          context1 = e.exerciseContext || '';
          context2 = e.foodContext || '';
          break;
        case 'weight':
          value1 = e.weight_kg || '';
          break;
        case 'steps':
          value1 = e.steps || '';
          break;
        case 'food':
          value1 = e.protein_g || '';
          value2 = e.carbs_g || '';
          value3 = e.fat_g || '';
          value4 = e.sodium_mg || '';
          name = e.foodName || '';
          quantity = e.quantity || '';
          break;
        case 'drink':
          value1 = e.volume_ml || '';
          value2 = e.protein_g || '';
          value3 = e.carbs_g || '';
          value4 = e.sodium_mg || '';
          value5 = e.caffeine_mg || '';
          name = e.drinkName || '';
          quantity = e.volume_ml || '';
          break;
        case 'medication':
          name = e.medName || '';
          quantity = e.dosage || '';
          context1 = e.status || '';
          context2 = e.timeOfDay || '';
          break;
        case 'ventolin':
          context1 = e.context || '';
          break;
        case 'afib':
        case 'sleep':
        case 'walk':
          // Start and end as separate conceptual entries
          break;
      }

      return [
        e.timestamp || '',
        e.eventType || '',
        value1, value2, value3, value4, value5,
        name, quantity, context1, context2,
        e.isDuringAFib ? 'true' : 'false',
        e.duration_min || '',
        (e.notes || '').replace(/"/g, '""'),
        e.lastEdited ? 'true' : 'false'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${v}"`).join(','))
    ].join('\n');

    this._download(csvContent, `heart-tracker-${UI.todayStr()}.csv`, 'text/csv');
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
