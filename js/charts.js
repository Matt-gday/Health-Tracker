/* ============================================
   Heart & Health Tracker — Charts Module
   Chart.js configurations for dashboard & details
   ============================================ */

const Charts = {
  _dashboardChart: null,
  _detailChart: null,

  /* Convert an ISO timestamp to a local YYYY-MM-DD string */
  _localDateKey(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /* Generate a local YYYY-MM-DD for N days ago */
  _localDayStr(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  /* ---------- Dashboard Chart ---------- */
  async renderDashboard(layers, range) {
    const canvas = document.getElementById('dashboard-chart');
    if (!canvas) return;

    if (this._dashboardChart) {
      this._dashboardChart.destroy();
      this._dashboardChart = null;
    }

    if (!layers || layers.length === 0) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Toggle data layers below to visualize', canvas.width / 2, canvas.height / 2);
      return;
    }

    const dateRange = this._getDateRange(range);
    const datasets = [];
    const allLabels = this._generateLabels(range, dateRange);

    for (const layer of layers) {
      const ds = await this._buildDataset(layer, dateRange, allLabels);
      if (ds) datasets.push(...(Array.isArray(ds) ? ds : [ds]));
    }

    const ctx = canvas.getContext('2d');
    this._dashboardChart = new Chart(ctx, {
      type: 'line',
      data: { labels: allLabels.map(l => this._formatLabel(l, range)), datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
          tooltip: { backgroundColor: '#1A1A2E', titleFont: { size: 12 }, bodyFont: { size: 11 } }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, maxRotation: 0, maxTicksLimit: 7 }
          },
          y: {
            grid: { color: '#F3F4F6' },
            ticks: { font: { size: 10 } },
            beginAtZero: false
          }
        }
      }
    });
  },

  /* ---------- Detail Page Charts ---------- */
  async renderDetail(type, events) {
    const canvas = document.getElementById('detail-chart');
    if (!canvas) return;

    if (this._detailChart) {
      this._detailChart.destroy();
      this._detailChart = null;
    }

    if (!events || events.length === 0) return;

    const ctx = canvas.getContext('2d');
    let config;

    switch (type) {
      case 'afib':
        config = this._buildAfibChart(events);
        break;
      case 'bp_hr':
        config = this._buildBpChart(events);
        break;
      case 'sleep':
        config = this._buildSleepChart(events);
        break;
      case 'weight':
        config = this._buildWeightChart(events);
        break;
      case 'activity':
        config = this._buildActivityChart(events);
        break;
      case 'food':
        config = this._buildFoodChart(events);
        break;
      case 'drink':
        config = this._buildDrinkChart(events);
        break;
      case 'nutrition':
        config = this._buildNutritionChart(events);
        break;
      case 'medication':
        config = this._buildMedChart(events);
        break;
      default:
        return;
    }

    if (config) {
      this._detailChart = new Chart(ctx, config);
    }
  },

  /* ---------- Dataset Builders ---------- */
  async _buildDataset(layer, dateRange, labels) {
    const [start, end] = dateRange;
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    switch (layer) {
      case 'bp': {
        const events = await DataSource.getEventsInRange(startISO, endISO, 'bp_hr');
        return [
          {
            label: 'Systolic',
            data: this._mapToLabels(events.filter(e => e.systolic), labels, 'systolic'),
            borderColor: '#EF4444',
            backgroundColor: 'rgba(239,68,68,0.1)',
            tension: 0.3, pointRadius: 3, borderWidth: 2
          },
          {
            label: 'Diastolic',
            data: this._mapToLabels(events.filter(e => e.diastolic), labels, 'diastolic'),
            borderColor: '#00B3B7',
            backgroundColor: 'rgba(0,179,183,0.1)',
            tension: 0.3, pointRadius: 3, borderWidth: 2
          }
        ];
      }
      case 'hr': {
        const events = await DataSource.getEventsInRange(startISO, endISO, 'bp_hr');
        return {
          label: 'Heart Rate',
          data: this._mapToLabels(events.filter(e => e.heartRate), labels, 'heartRate'),
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245,158,11,0.1)',
          tension: 0.3, pointRadius: 3, borderWidth: 2
        };
      }
      case 'weight': {
        const events = await DataSource.getEventsInRange(startISO, endISO, 'weight');
        return {
          label: 'Weight (kg)',
          data: this._mapToLabels(events, labels, 'weight_kg'),
          borderColor: '#00B3B7',
          backgroundColor: 'rgba(0,179,183,0.1)',
          tension: 0.3, pointRadius: 3, borderWidth: 2, fill: true
        };
      }
      case 'sleep': {
        const events = await DataSource.getEventsInRange(startISO, endISO, 'sleep');
        const completed = events.filter(e => e.duration_min);
        return {
          label: 'Sleep (hours)',
          data: this._mapToLabels(completed, labels, 'duration_min', v => Math.round(v / 60 * 10) / 10),
          borderColor: '#8B5CF6',
          backgroundColor: 'rgba(139,92,246,0.2)',
          type: 'bar', borderWidth: 1, barPercentage: 0.6
        };
      }
      case 'steps': {
        const events = await DataSource.getEventsInRange(startISO, endISO, 'steps');
        return {
          label: 'Steps',
          data: this._mapToLabels(events, labels, 'steps'),
          borderColor: '#D97706',
          backgroundColor: 'rgba(217,119,6,0.2)',
          type: 'bar', borderWidth: 1, barPercentage: 0.6
        };
      }
      case 'walk': {
        const events = await DataSource.getEventsInRange(startISO, endISO, 'walk');
        const completed = events.filter(e => e.duration_min);
        return {
          label: 'Walk (min)',
          data: this._mapToLabels(completed, labels, 'duration_min'),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16,185,129,0.2)',
          type: 'bar', borderWidth: 1, barPercentage: 0.6
        };
      }
      case 'drink': {
        const events = await DataSource.getEventsInRange(startISO, endISO, 'drink');
        return {
          label: 'Fluid (mL)',
          data: this._mapToLabels(events, labels, 'volume_ml'),
          borderColor: '#00B3B7',
          backgroundColor: 'rgba(0,179,183,0.25)',
          type: 'bar', borderWidth: 1, barPercentage: 0.6
        };
      }
      default:
        return null;
    }
  },

  /* ---------- Detail Chart Configs ---------- */
  /* Classify BP reading into color — matches UI.bpCategory */
  _bpColor(sys, dia) {
    const s = sys || 0, d = dia || 0;
    if (s > 180 || d > 120) return '#991B1B'; // Crisis — dark red
    if (s >= 140 || d >= 90) return '#DC2626'; // High — red
    if (s >= 130 || d >= 80) return '#EC4899'; // Elevated — pink
    if (s >= 120 && d < 80)  return '#EC4899'; // Elevated
    if (s < 90 || d < 60)    return '#3B82F6'; // Low — blue
    return '#10B981'; // Normal — green
  },

  _buildBpChart(events) {
    const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-30);
    const labels = sorted.map(e => UI.formatDate(e.timestamp));

    const sysData = sorted.map(e => e.systolic || null);
    const diaData = sorted.map(e => e.diastolic || null);
    const hrData = sorted.map(e => e.heartRate || null);

    // Color each point by BP category (AFib readings keep the AFib amber ring)
    const sysPointBg = sorted.map(e => this._bpColor(e.systolic, e.diastolic));
    const diaPointBg = sorted.map(e => this._bpColor(e.systolic, e.diastolic));
    const sysPointBorder = sorted.map(e => e.isDuringAFib ? '#F59E0B' : this._bpColor(e.systolic, e.diastolic));
    const diaPointBorder = sorted.map(e => e.isDuringAFib ? '#F59E0B' : this._bpColor(e.systolic, e.diastolic));

    // Custom plugin to draw BP zone backgrounds
    const bpZonePlugin = {
      id: 'bpZones',
      beforeDraw(chart) {
        const { ctx, chartArea: { left, right, top, bottom }, scales: { y } } = chart;
        if (!y) return;
        const zones = [
          { min: 0,   max: 90,  color: 'rgba(59,130,246,0.06)' },   // Low zone
          { min: 90,  max: 120, color: 'rgba(16,185,129,0.08)' },   // Normal zone
          { min: 120, max: 130, color: 'rgba(236,72,153,0.06)' },   // Elevated zone
          { min: 130, max: 140, color: 'rgba(236,72,153,0.10)' },   // High Stage 1
          { min: 140, max: 200, color: 'rgba(220,38,38,0.08)' }     // High Stage 2+
        ];
        ctx.save();
        zones.forEach(z => {
          const yTop = y.getPixelForValue(Math.min(z.max, y.max));
          const yBot = y.getPixelForValue(Math.max(z.min, y.min));
          if (yBot > top && yTop < bottom) {
            ctx.fillStyle = z.color;
            ctx.fillRect(left, Math.max(yTop, top), right - left, Math.min(yBot, bottom) - Math.max(yTop, top));
          }
        });
        // Draw threshold lines
        const thresholds = [
          { val: 90,  color: 'rgba(59,130,246,0.3)', dash: [4,4] },
          { val: 120, color: 'rgba(16,185,129,0.4)', dash: [4,4] },
          { val: 140, color: 'rgba(220,38,38,0.4)',  dash: [4,4] }
        ];
        thresholds.forEach(t => {
          if (t.val >= y.min && t.val <= y.max) {
            const py = y.getPixelForValue(t.val);
            ctx.strokeStyle = t.color;
            ctx.lineWidth = 1;
            ctx.setLineDash(t.dash);
            ctx.beginPath();
            ctx.moveTo(left, py);
            ctx.lineTo(right, py);
            ctx.stroke();
          }
        });
        ctx.restore();
      }
    };

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Systolic', data: sysData,
            borderColor: 'rgba(150,150,150,0.3)',
            pointBackgroundColor: sysPointBg,
            pointBorderColor: sysPointBorder,
            pointBorderWidth: sorted.map(e => e.isDuringAFib ? 3 : 1),
            segment: {
              borderColor: (ctx) => {
                const i = ctx.p0DataIndex;
                return sysPointBg[i] || '#999';
              }
            },
            tension: 0.3, pointRadius: 5, borderWidth: 2
          },
          {
            label: 'Diastolic', data: diaData,
            borderColor: 'rgba(150,150,150,0.3)',
            pointBackgroundColor: diaPointBg,
            pointBorderColor: diaPointBorder,
            pointBorderWidth: sorted.map(e => e.isDuringAFib ? 3 : 1),
            segment: {
              borderColor: (ctx) => {
                const i = ctx.p0DataIndex;
                return diaPointBg[i] || '#999';
              }
            },
            tension: 0.3, pointRadius: 5, borderWidth: 2
          },
          {
            label: 'Heart Rate', data: hrData,
            borderColor: 'rgba(100,100,100,0.3)',
            pointBackgroundColor: '#6B7280',
            tension: 0.3, pointRadius: 3, borderWidth: 1, borderDash: [5, 5]
          }
        ]
      },
      options: {
        ...this._defaultChartOptions(),
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { boxWidth: 10, font: { size: 10 } }
          },
          tooltip: {
            callbacks: {
              afterLabel: (ctx) => {
                if (ctx.datasetIndex > 1) return '';
                const e = sorted[ctx.dataIndex];
                if (!e) return '';
                const cat = UI.bpCategory(e.systolic, e.diastolic);
                let tip = cat.label ? `Status: ${cat.label}` : '';
                if (e.isDuringAFib) tip += tip ? ' · During AFib' : 'During AFib';
                return tip;
              }
            }
          }
        }
      },
      plugins: [bpZonePlugin]
    };
  },

  _buildWeightChart(events) {
    const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return {
      type: 'line',
      data: {
        labels: sorted.map(e => UI.formatDate(e.timestamp)),
        datasets: [{
          label: 'Weight (kg)',
          data: sorted.map(e => e.weight_kg),
          borderColor: '#00B3B7',
          backgroundColor: 'rgba(0,179,183,0.1)',
          fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2
        }]
      },
      options: this._defaultChartOptions()
    };
  },

  _buildSleepChart(events) {
    const completed = events.filter(e => e.duration_min).sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-30);
    return {
      type: 'bar',
      data: {
        labels: completed.map(e => UI.formatDate(e.timestamp)),
        datasets: [{
          label: 'Sleep (hours)',
          data: completed.map(e => Math.round(e.duration_min / 60 * 10) / 10),
          backgroundColor: 'rgba(139,92,246,0.6)',
          borderColor: '#8B5CF6',
          borderWidth: 1, borderRadius: 4
        }]
      },
      options: this._defaultChartOptions()
    };
  },

  _buildAfibChart(events) {
    // Calendar-style: events per day in last 30 days
    const now = new Date();
    const days = [];
    for (let i = 29; i >= 0; i--) {
      days.push(this._localDayStr(i));
    }
    const countByDay = {};
    events.filter(e => e.endTime).forEach(e => {
      const day = this._localDateKey(e.timestamp);
      countByDay[day] = (countByDay[day] || 0) + 1;
    });

    return {
      type: 'bar',
      data: {
        labels: days.map(d => { const dt = new Date(d); return `${dt.getDate()}/${dt.getMonth() + 1}`; }),
        datasets: [{
          label: 'AFib Episodes',
          data: days.map(d => countByDay[d] || 0),
          backgroundColor: days.map(d => countByDay[d] ? 'rgba(245,158,11,0.7)' : 'rgba(229,231,235,0.3)'),
          borderColor: days.map(d => countByDay[d] ? '#D97706' : 'transparent'),
          borderWidth: 1, borderRadius: 3
        }]
      },
      options: { ...this._defaultChartOptions(), plugins: { legend: { display: false } } }
    };
  },

  _buildActivityChart(events) {
    const walks = events.filter(e => e.eventType === 'walk' && e.duration_min);
    const steps = events.filter(e => e.eventType === 'steps');
    const allDates = [...new Set([...walks, ...steps].map(e => (e.date || this._localDateKey(e.timestamp))))].sort().slice(-14);

    return {
      type: 'bar',
      data: {
        labels: allDates.map(d => { const dt = new Date(d); return `${dt.getDate()}/${dt.getMonth() + 1}`; }),
        datasets: [
          {
            label: 'Walk (min)',
            data: allDates.map(d => {
              const w = walks.find(e => this._localDateKey(e.timestamp) === d);
              return w ? w.duration_min : 0;
            }),
            backgroundColor: 'rgba(16,185,129,0.6)',
            borderColor: '#10B981',
            borderWidth: 1, borderRadius: 3, yAxisID: 'y'
          },
          {
            label: 'Steps',
            data: allDates.map(d => {
              const s = steps.find(e => e.date === d);
              return s ? s.steps : 0;
            }),
            backgroundColor: 'rgba(217,119,6,0.4)',
            borderColor: '#D97706',
            borderWidth: 1, borderRadius: 3, yAxisID: 'y1'
          }
        ]
      },
      options: {
        ...this._defaultChartOptions(),
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0 } },
          y: { position: 'left', grid: { color: '#F3F4F6' }, title: { display: true, text: 'Walk (min)', font: { size: 10 } } },
          y1: { position: 'right', grid: { display: false }, title: { display: true, text: 'Steps', font: { size: 10 } } }
        }
      }
    };
  },

  _buildFoodChart(events) {
    // Daily macro totals for last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      days.push(this._localDayStr(i));
    }
    // Group events by local date
    const byDay = {};
    events.forEach(e => { const dk = this._localDateKey(e.timestamp); if (!byDay[dk]) byDay[dk] = []; byDay[dk].push(e); });
    const dailyData = days.map(day => {
      const dayEvents = byDay[day] || [];
      return {
        calories: dayEvents.reduce((s, e) => s + (e.calories || 0), 0),
        protein: dayEvents.reduce((s, e) => s + (e.protein_g || 0), 0),
        carbs: dayEvents.reduce((s, e) => s + (e.carbs_g || 0), 0),
        fat: dayEvents.reduce((s, e) => s + (e.fat_g || 0), 0)
      };
    });

    return {
      type: 'bar',
      data: {
        labels: days.map(d => { const dt = new Date(d + 'T12:00:00'); return `${dt.getDate()}/${dt.getMonth() + 1}`; }),
        datasets: [
          { label: 'Calories', data: dailyData.map(d => Math.round(d.calories)), type: 'line', borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)', tension: 0.3, pointRadius: 3, borderWidth: 2, yAxisID: 'y1', fill: false },
          { label: 'Protein (g)', data: dailyData.map(d => Math.round(d.protein)), backgroundColor: 'rgba(16,185,129,0.6)', borderRadius: 3, yAxisID: 'y' },
          { label: 'Carbs (g)', data: dailyData.map(d => Math.round(d.carbs)), backgroundColor: 'rgba(59,130,246,0.6)', borderRadius: 3, yAxisID: 'y' },
          { label: 'Fat (g)', data: dailyData.map(d => Math.round(d.fat)), backgroundColor: 'rgba(245,158,11,0.6)', borderRadius: 3, yAxisID: 'y' }
        ]
      },
      options: {
        ...this._defaultChartOptions(),
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0 } },
          y: { position: 'left', grid: { color: '#F3F4F6' }, title: { display: true, text: 'Macros (g)', font: { size: 10 } } },
          y1: { position: 'right', grid: { display: false }, title: { display: true, text: 'Calories', font: { size: 10 } } }
        },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
      }
    };
  },

  _buildDrinkChart(events) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      days.push(this._localDayStr(i));
    }
    // Group events by local date
    const byDay = {};
    events.forEach(e => { const dk = this._localDateKey(e.timestamp); if (!byDay[dk]) byDay[dk] = []; byDay[dk].push(e); });

    return {
      type: 'bar',
      data: {
        labels: days.map(d => { const dt = new Date(d + 'T12:00:00'); return `${dt.getDate()}/${dt.getMonth() + 1}`; }),
        datasets: [{
          label: 'Fluid (mL)',
          data: days.map(day => {
            return (byDay[day] || []).reduce((s, e) => s + (e.volume_ml || 0), 0);
          }),
          backgroundColor: 'rgba(0,179,183,0.5)',
          borderColor: '#00B3B7',
          borderWidth: 1, borderRadius: 4
        }]
      },
      options: this._defaultChartOptions()
    };
  },

  _buildNutritionChart(events) {
    // Combined food + drink macros per day for last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      days.push(this._localDayStr(i));
    }
    const byDay = {};
    events.forEach(e => {
      const dk = this._localDateKey(e.timestamp);
      if (!byDay[dk]) byDay[dk] = [];
      byDay[dk].push(e);
    });
    const dailyData = days.map(day => {
      const dayEvents = byDay[day] || [];
      return {
        calories: dayEvents.reduce((s, e) => s + (e.calories || 0), 0),
        protein: dayEvents.reduce((s, e) => s + (e.protein_g || 0), 0),
        carbs: dayEvents.reduce((s, e) => s + (e.carbs_g || 0), 0),
        fat: dayEvents.reduce((s, e) => s + (e.fat_g || 0), 0),
        fluid: dayEvents.filter(e => e.eventType === 'drink').reduce((s, e) => s + (e.volume_ml || 0), 0)
      };
    });

    return {
      type: 'bar',
      data: {
        labels: days.map(d => { const dt = new Date(d + 'T12:00:00'); return `${dt.getDate()}/${dt.getMonth() + 1}`; }),
        datasets: [
          { label: 'Calories', data: dailyData.map(d => Math.round(d.calories)), type: 'line', borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)', tension: 0.3, pointRadius: 3, borderWidth: 2, yAxisID: 'y1', fill: false },
          { label: 'Protein (g)', data: dailyData.map(d => Math.round(d.protein)), backgroundColor: 'rgba(16,185,129,0.6)', borderRadius: 3, yAxisID: 'y' },
          { label: 'Carbs (g)', data: dailyData.map(d => Math.round(d.carbs)), backgroundColor: 'rgba(59,130,246,0.6)', borderRadius: 3, yAxisID: 'y' },
          { label: 'Fat (g)', data: dailyData.map(d => Math.round(d.fat)), backgroundColor: 'rgba(245,158,11,0.6)', borderRadius: 3, yAxisID: 'y' }
        ]
      },
      options: {
        ...this._defaultChartOptions(),
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0 } },
          y: { position: 'left', grid: { color: '#F3F4F6' }, title: { display: true, text: 'Macros (g)', font: { size: 10 } } },
          y1: { position: 'right', grid: { display: false }, title: { display: true, text: 'Calories', font: { size: 10 } } }
        },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
      }
    };
  },

  _buildMedChart(events) {
    // Show last 14 days of medication adherence
    const medOnly = events.filter(e => e.eventType === 'medication');
    const days = [];
    for (let i = 13; i >= 0; i--) {
      days.push(this._localDayStr(i));
    }

    // Group meds by local date
    const medsByDay = {};
    medOnly.forEach(e => {
      const dk = this._localDateKey(e.timestamp);
      if (!medsByDay[dk]) medsByDay[dk] = [];
      medsByDay[dk].push(e);
    });

    // For each day, count AM taken/skipped and PM taken/skipped
    const amTaken = [];
    const amSkipped = [];
    const pmTaken = [];
    const pmSkipped = [];

    days.forEach(day => {
      const dayMeds = medsByDay[day] || [];
      const am = dayMeds.filter(e => e.timeOfDay === 'AM');
      const pm = dayMeds.filter(e => e.timeOfDay === 'PM');

      amTaken.push(am.filter(e => e.status === 'Taken').length);
      amSkipped.push(am.filter(e => e.status === 'Skipped').length);
      pmTaken.push(pm.filter(e => e.status === 'Taken').length);
      pmSkipped.push(pm.filter(e => e.status === 'Skipped').length);
    });

    const labels = days.map(d => {
      const dt = new Date(d + 'T12:00:00');
      return dt.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' });
    });

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'AM Taken',
            data: amTaken,
            backgroundColor: 'rgba(16,185,129,0.7)',
            borderRadius: 2, stack: 'am'
          },
          {
            label: 'AM Skipped',
            data: amSkipped,
            backgroundColor: 'rgba(239,68,68,0.7)',
            borderRadius: 2, stack: 'am'
          },
          {
            label: 'PM Taken',
            data: pmTaken,
            backgroundColor: 'rgba(0,179,183,0.7)',
            borderRadius: 2, stack: 'pm'
          },
          {
            label: 'PM Skipped',
            data: pmSkipped,
            backgroundColor: 'rgba(245,158,11,0.8)',
            borderRadius: 2, stack: 'pm'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, padding: 6, font: { size: 10 } }
          },
          tooltip: {
            backgroundColor: '#1A1A2E',
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            callbacks: {
              afterBody(items) {
                const idx = items[0]?.dataIndex;
                if (idx == null) return '';
                const dayTotal = (amTaken[idx] || 0) + (amSkipped[idx] || 0) + (pmTaken[idx] || 0) + (pmSkipped[idx] || 0);
                const daySkipped = (amSkipped[idx] || 0) + (pmSkipped[idx] || 0);
                if (dayTotal === 0) return '\nNo meds logged';
                if (daySkipped > 0) return `\n⚠ ${daySkipped} dose${daySkipped > 1 ? 's' : ''} skipped`;
                return '\n✓ All doses taken';
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 45 },
            stacked: true
          },
          y: {
            stacked: true,
            grid: { color: '#F3F4F6' },
            ticks: { font: { size: 10 }, stepSize: 1 },
            title: { display: true, text: 'Doses', font: { size: 10 } }
          }
        }
      }
    };
  },

  /* ---------- Helpers ---------- */
  _getDateRange(range) {
    const end = new Date();
    const start = new Date();
    switch (range) {
      case 'day': start.setDate(start.getDate() - 1); break;
      case 'week': start.setDate(start.getDate() - 7); break;
      case 'month': start.setMonth(start.getMonth() - 1); break;
      case '3months': start.setMonth(start.getMonth() - 3); break;
      case 'year': start.setFullYear(start.getFullYear() - 1); break;
      case 'all': start.setFullYear(start.getFullYear() - 10); break;
    }
    return [start, end];
  },

  _generateLabels(range, dateRange) {
    const [start, end] = dateRange;
    const labels = [];
    const d = new Date(start);
    while (d <= end) {
      labels.push(this._localDateKey(d.toISOString()));
      d.setDate(d.getDate() + 1);
    }
    return labels;
  },

  _formatLabel(dateStr, range) {
    const d = new Date(dateStr);
    if (range === 'day') return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
    if (range === 'week') return d.toLocaleDateString('en-AU', { weekday: 'short' });
    return `${d.getDate()}/${d.getMonth() + 1}`;
  },

  _mapToLabels(events, labels, field, transform = null) {
    // Group events by local date and average
    const byDate = {};
    events.forEach(e => {
      const day = this._localDateKey(e.timestamp);
      if (!byDate[day]) byDate[day] = [];
      let val = e[field];
      if (transform) val = transform(val);
      if (val != null) byDate[day].push(val);
    });

    return labels.map(dateStr => {
      const vals = byDate[dateStr];
      if (!vals || vals.length === 0) return null;
      // Sum for bars, average for lines
      return Math.round(vals.reduce((a, b) => a + b) / vals.length * 10) / 10;
    });
  },

  _defaultChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 11 } } },
        tooltip: { backgroundColor: '#1A1A2E', titleFont: { size: 12 }, bodyFont: { size: 11 } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, maxTicksLimit: 7 } },
        y: { grid: { color: '#F3F4F6' }, ticks: { font: { size: 10 } } }
      }
    };
  }
};
