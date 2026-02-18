/* ============================================
   Heart & Health Tracker — Charts Module
   Chart.js configurations for dashboard & details
   ============================================ */

const Charts = {
  _dashboardChart: null,
  _detailChart: null,

  /* Per-chart time range state — defaults */
  _chartRanges: {
    afib: 'month', bp_hr: 'month', sleep: 'month', weight: 'month',
    activity: 'month', food: 'week', drink: 'week', nutrition: 'week', medication: 'month',
    symptom: 'month', ventolin: 'month'
  },

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

  /* Get the number of days for the current range of a chart type */
  _rangeDays(type) {
    const r = this._chartRanges[type] || 'month';
    if (r === 'week') return 7;
    if (r === 'month') return 30;
    if (r === '3month') return 90;
    return null; // 'all'
  },

  /* Filter sorted events by the range for a given chart type */
  _filterByRange(sorted, type) {
    const days = this._rangeDays(type);
    if (!days) return sorted; // all time
    const cutoff = new Date(Date.now() - days * 86400000);
    const filtered = sorted.filter(e => new Date(e.timestamp) >= cutoff);
    return filtered.length > 0 ? filtered : sorted; // fallback if empty
  },

  /* Generate day labels array for the current range */
  _rangeDayLabels(type) {
    const days = this._rangeDays(type) || 180; // cap 'all' at 6 months for day-based charts
    const labels = [];
    for (let i = days - 1; i >= 0; i--) {
      labels.push(this._localDayStr(i));
    }
    return labels;
  },

  /* Consistent legend: outlined squares for lines, filled for bars */
  _consistentLegend() {
    return {
      display: true,
      position: 'bottom',
      labels: {
        boxWidth: 12,
        boxHeight: 12,
        padding: 10,
        font: { size: 11 },
        generateLabels: function(chart) {
          return chart.data.datasets.map((ds, i) => {
            const isBar = ds.type === 'bar' || (!ds.type && chart.config.type === 'bar');
            const isDashed = ds.borderDash && ds.borderDash.length > 0;
            return {
              text: ds.label,
              fillStyle: isBar ? (ds.backgroundColor || ds.borderColor) : 'transparent',
              strokeStyle: ds.borderColor || ds.backgroundColor,
              lineWidth: isBar ? 0 : 1.5,
              lineDash: isDashed ? [3, 2] : [],
              hidden: !chart.isDatasetVisible(i),
              datasetIndex: i
            };
          });
        }
      }
    };
  },

  /* Hidden dataset indices — preserved across range changes, reset on page close */
  _hiddenDatasets: [],

  /* ---------- Detail Page Charts ---------- */
  async renderDetail(type, events, drinksAlcohol = false) {
    const canvas = document.getElementById('detail-chart');
    if (!canvas) return;

    // Save current hidden state before destroying
    if (this._detailChart) {
      this._hiddenDatasets = this._detailChart.data.datasets
        .map((ds, i) => (!this._detailChart.isDatasetVisible(i)) ? ds.label : null)
        .filter(l => l !== null);
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
        config = await this._buildWeightChart(events);
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
        config = this._buildNutritionChart(events, drinksAlcohol);
        break;
      case 'medication':
        config = this._buildMedChart(events);
        break;
      case 'ventolin':
        config = this._buildVentolinChart(events);
        break;
      case 'symptom':
        config = this._buildSymptomChart(events);
        break;
      default:
        return;
    }

    if (config) {
      // Re-apply hidden state by matching dataset labels
      if (this._hiddenDatasets.length > 0) {
        config.data.datasets.forEach(ds => {
          if (this._hiddenDatasets.includes(ds.label)) {
            ds.hidden = true;
          }
        });
      }
      this._detailChart = new Chart(ctx, config);
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
    const allSorted = this._filterByRange(
      [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp)), 'bp_hr'
    );

    // Compute global Y bounds from ALL readings in current time range (for fixed axis across contexts)
    const allValues = allSorted.flatMap(e => [e.systolic, e.diastolic, e.heartRate].filter(v => v));
    const globalMin = allValues.length > 0 ? Math.min(...allValues) - 10 : 50;
    const globalMax = allValues.length > 0 ? Math.max(...allValues) + 10 : 200;

    // Filter by BP context (morning / post-walk / evening)
    const context = App._bpContext || 'morning';
    const walks = App._cachedWalkEvents || [];
    const sorted = allSorted.filter(e => App.classifyBpReading(e, walks) === context);

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
          { min: 0,   max: 90,  color: 'rgba(59,130,246,0.06)' },
          { min: 90,  max: 120, color: 'rgba(16,185,129,0.08)' },
          { min: 120, max: 130, color: 'rgba(236,72,153,0.06)' },
          { min: 130, max: 140, color: 'rgba(236,72,153,0.10)' },
          { min: 140, max: 200, color: 'rgba(220,38,38,0.08)' }
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
            tension: 0.3, pointRadius: 3, borderWidth: 1, borderDash: [3, 2]
          }
        ]
      },
      options: {
        ...this._defaultChartOptions(),
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, maxTicksLimit: 7 } },
          y: {
            grid: { color: '#F3F4F6' },
            ticks: { font: { size: 10 } },
            suggestedMin: globalMin,
            suggestedMax: globalMax
          }
        },
        plugins: {
          legend: this._consistentLegend(),
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

  async _buildWeightChart(events) {
    const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const filtered = this._filterByRange(sorted, 'weight');

    const labels = filtered.map(e => UI.formatDate(e.timestamp));
    const weights = filtered.map(e => e.weight_kg);

    // Calculate EMA trend line (smoothing factor α = 0.3)
    const alpha = 0.3;
    const ema = [weights[0]];
    for (let i = 1; i < weights.length; i++) {
      ema.push(Math.round((alpha * weights[i] + (1 - alpha) * ema[i - 1]) * 10) / 10);
    }

    const goalWeight = await DB.getSetting('goalWeight');
    const datasets = [
      {
        label: 'Weight',
        data: weights,
        borderColor: '#00B3B7',
        backgroundColor: 'rgba(0,179,183,0.08)',
        fill: true, tension: 0.2, pointRadius: 4, borderWidth: 2,
        pointBackgroundColor: '#00B3B7'
      },
      {
        label: 'Trend',
        data: ema,
        borderColor: '#F59E0B',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [3, 2],
        pointRadius: 0,
        tension: 0.3,
        fill: false
      }
    ];

    // Always add goal dataset if a goal weight exists, but hidden by default
    if (goalWeight) {
      datasets.push({
        label: 'Goal',
        data: Array(weights.length).fill(goalWeight),
        borderColor: '#10B981',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [3, 2],
        pointRadius: 0,
        fill: false,
        hidden: true
      });
    }

    return {
      type: 'line',
      data: { labels, datasets },
      options: {
        ...this._defaultChartOptions(),
        scales: {
          y: {
            ticks: { callback: v => v + ' kg' }
          },
          x: {
            ticks: { maxRotation: 45, font: { size: 10 } }
          }
        },
        plugins: {
          legend: this._consistentLegend(),
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} kg`
            }
          }
        }
      }
    };
  },

  _buildSleepChart(events) {
    const allCompleted = events.filter(e => e.duration_min).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const completed = this._filterByRange(allCompleted, 'sleep');

    // Calculate 7-night average trend
    const hours = completed.map(e => Math.round(e.duration_min / 60 * 10) / 10);
    const avg = [];
    for (let i = 0; i < hours.length; i++) {
      const window = hours.slice(Math.max(0, i - 6), i + 1);
      avg.push(Math.round(window.reduce((a, b) => a + b, 0) / window.length * 10) / 10);
    }

    return {
      type: 'bar',
      data: {
        labels: completed.map(e => UI.formatDate(e.timestamp)),
        datasets: [
          {
            label: 'Sleep (hrs)',
            data: hours,
            backgroundColor: 'rgba(139,92,246,0.6)',
            borderColor: '#8B5CF6',
            borderWidth: 1, borderRadius: 4
          },
          {
            label: '7-night Avg',
            data: avg,
            type: 'line',
            borderColor: '#F59E0B',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [3, 2],
            pointRadius: 0,
            tension: 0.3,
            fill: false
          }
        ]
      },
      options: {
        ...this._defaultChartOptions(),
        plugins: {
          legend: this._consistentLegend(),
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} hrs`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, maxTicksLimit: 7 } },
          y: { grid: { color: '#F3F4F6' }, ticks: { font: { size: 10 }, callback: v => v + 'h' } }
        }
      }
    };
  },

  _buildAfibChart(events) {
    const days = this._rangeDayLabels('afib');
    const durationByDay = {};
    const countByDay = {};
    events.filter(e => e.endTime && e.duration_min).forEach(e => {
      const day = this._localDateKey(e.timestamp);
      durationByDay[day] = (durationByDay[day] || 0) + e.duration_min;
      countByDay[day] = (countByDay[day] || 0) + 1;
    });

    return {
      type: 'bar',
      data: {
        labels: days.map(d => { const dt = new Date(d + 'T12:00:00'); return `${dt.getDate()}/${dt.getMonth() + 1}`; }),
        datasets: [{
          label: 'AFib Duration (hrs)',
          data: days.map(d => durationByDay[d] ? Math.round(durationByDay[d] / 60 * 10) / 10 : 0),
          backgroundColor: days.map(d => durationByDay[d] ? 'rgba(245,158,11,0.7)' : 'rgba(229,231,235,0.3)'),
          borderColor: days.map(d => durationByDay[d] ? '#D97706' : 'transparent'),
          borderWidth: 1, borderRadius: 3
        }]
      },
      options: {
        ...this._defaultChartOptions(),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const day = days[ctx.dataIndex];
                const hrs = ctx.parsed.y;
                const count = countByDay[day] || 0;
                return hrs > 0 ? `${hrs} hrs (${count} episode${count !== 1 ? 's' : ''})` : 'No episodes';
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, maxTicksLimit: 7 } },
          y: { grid: { color: '#F3F4F6' }, ticks: { font: { size: 10 }, callback: v => v + 'h' } }
        }
      }
    };
  },

  _buildActivityChart(events) {
    const days = this._rangeDayLabels('activity');
    const walks = events.filter(e => e.eventType === 'walk' && e.duration_min);
    const steps = events.filter(e => e.eventType === 'steps');

    return {
      type: 'bar',
      data: {
        labels: days.map(d => { const dt = new Date(d + 'T12:00:00'); return `${dt.getDate()}/${dt.getMonth() + 1}`; }),
        datasets: [
          {
            label: 'Walk (min)',
            data: days.map(d => {
              const dayWalks = walks.filter(e => this._localDateKey(e.timestamp) === d);
              return dayWalks.reduce((s, e) => s + (e.duration_min || 0), 0);
            }),
            backgroundColor: 'rgba(16,185,129,0.6)',
            borderColor: '#10B981',
            borderWidth: 1, borderRadius: 3, yAxisID: 'y'
          },
          {
            label: 'Steps',
            data: days.map(d => {
              const s = steps.find(e => (e.date || this._localDateKey(e.timestamp)) === d);
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
        plugins: {
          legend: this._consistentLegend(),
          tooltip: { backgroundColor: '#1A1A2E', titleFont: { size: 12 }, bodyFont: { size: 11 } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, maxTicksLimit: 7 } },
          y: { position: 'left', grid: { color: '#F3F4F6' }, title: { display: true, text: 'Walk (min)', font: { size: 10 } } },
          y1: { position: 'right', grid: { display: false }, title: { display: true, text: 'Steps', font: { size: 10 } } }
        }
      }
    };
  },

  _buildFoodChart(events) {
    const days = this._rangeDayLabels('food');
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
          { label: 'Calories', data: dailyData.map(d => Math.round(d.calories)), type: 'line', borderColor: '#EF4444', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, borderWidth: 2, yAxisID: 'y1', fill: false },
          { label: 'Protein (g)', data: dailyData.map(d => Math.round(d.protein)), backgroundColor: 'rgba(16,185,129,0.6)', borderColor: '#10B981', borderRadius: 3, yAxisID: 'y' },
          { label: 'Carbs (g)', data: dailyData.map(d => Math.round(d.carbs)), backgroundColor: 'rgba(59,130,246,0.6)', borderColor: '#3B82F6', borderRadius: 3, yAxisID: 'y' },
          { label: 'Fat (g)', data: dailyData.map(d => Math.round(d.fat)), backgroundColor: 'rgba(245,158,11,0.6)', borderColor: '#F59E0B', borderRadius: 3, yAxisID: 'y' }
        ]
      },
      options: {
        ...this._defaultChartOptions(),
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, maxTicksLimit: 7 } },
          y: { position: 'left', grid: { color: '#F3F4F6' }, title: { display: true, text: 'Macros (g)', font: { size: 10 } } },
          y1: { position: 'right', grid: { display: false }, title: { display: true, text: 'Calories', font: { size: 10 } } }
        },
        plugins: { legend: this._consistentLegend() }
      }
    };
  },

  _buildDrinkChart(events) {
    const days = this._rangeDayLabels('drink');
    const byDay = {};
    events.forEach(e => { const dk = this._localDateKey(e.timestamp); if (!byDay[dk]) byDay[dk] = []; byDay[dk].push(e); });

    return {
      type: 'bar',
      data: {
        labels: days.map(d => { const dt = new Date(d + 'T12:00:00'); return `${dt.getDate()}/${dt.getMonth() + 1}`; }),
        datasets: [
          {
            label: 'Fluid (mL)',
            data: days.map(day => (byDay[day] || []).reduce((s, e) => s + (e.volume_ml || 0), 0)),
            backgroundColor: 'rgba(0,179,183,0.5)',
            borderColor: '#00B3B7',
            borderWidth: 1, borderRadius: 4
          },
          {
            label: 'Caffeine (mg)',
            data: days.map(day => (byDay[day] || []).reduce((s, e) => s + (e.caffeine_mg || 0), 0)),
            type: 'line',
            borderColor: '#6B7280',
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderDash: [3, 2],
            pointRadius: 2,
            tension: 0.3,
            fill: false,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        ...this._defaultChartOptions(),
        plugins: {
          legend: this._consistentLegend(),
          tooltip: { backgroundColor: '#1A1A2E', titleFont: { size: 12 }, bodyFont: { size: 11 } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, maxTicksLimit: 7 } },
          y: { position: 'left', grid: { color: '#F3F4F6' }, title: { display: true, text: 'Fluid (mL)', font: { size: 10 } } },
          y1: { position: 'right', grid: { display: false }, title: { display: true, text: 'Caffeine (mg)', font: { size: 10 } } }
        }
      }
    };
  },

  _buildNutritionChart(events, drinksAlcohol = false) {
    const days = this._rangeDayLabels('nutrition');
    const byDay = {};
    events.forEach(e => {
      const dk = this._localDateKey(e.timestamp);
      if (!byDay[dk]) byDay[dk] = [];
      byDay[dk].push(e);
    });
    const dailyData = days.map(day => {
      const dayEvents = byDay[day] || [];
      const drinks = dayEvents.filter(e => e.eventType === 'drink');
      return {
        calories: dayEvents.reduce((s, e) => s + (e.calories || 0), 0),
        protein: dayEvents.reduce((s, e) => s + (e.protein_g || 0), 0),
        carbs: dayEvents.reduce((s, e) => s + (e.carbs_g || 0), 0),
        fat: dayEvents.reduce((s, e) => s + (e.fat_g || 0), 0),
        sodium: dayEvents.reduce((s, e) => s + (e.sodium_mg || 0), 0),
        caffeine: drinks.reduce((s, e) => s + (e.caffeine_mg || 0), 0),
        alcohol: drinksAlcohol ? drinks.reduce((s, e) => s + (e.alcohol_units || 0), 0) : 0
      };
    });

    const datasets = [
      { label: 'Calories', data: dailyData.map(d => Math.round(d.calories)), type: 'line', borderColor: '#EF4444', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, borderWidth: 2, yAxisID: 'y1', fill: false },
      { label: 'Protein (g)', data: dailyData.map(d => Math.round(d.protein)), backgroundColor: 'rgba(16,185,129,0.6)', borderColor: '#10B981', borderRadius: 3, yAxisID: 'y' },
      { label: 'Carbs (g)', data: dailyData.map(d => Math.round(d.carbs)), backgroundColor: 'rgba(59,130,246,0.6)', borderColor: '#3B82F6', borderRadius: 3, yAxisID: 'y' },
      { label: 'Fat (g)', data: dailyData.map(d => Math.round(d.fat)), backgroundColor: 'rgba(245,158,11,0.6)', borderColor: '#F59E0B', borderRadius: 3, yAxisID: 'y' },
      { label: 'Sodium (mg)', data: dailyData.map(d => Math.round(d.sodium)), type: 'line', borderColor: '#8B5CF6', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, borderWidth: 1.5, borderDash: [3, 2], yAxisID: 'y2', fill: false },
      { label: 'Caffeine (mg)', data: dailyData.map(d => Math.round(d.caffeine)), type: 'line', borderColor: '#92400E', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, borderWidth: 1.5, borderDash: [3, 2], yAxisID: 'y2', fill: false }
    ];
    if (drinksAlcohol) {
      datasets.push({ label: 'Alcohol (drinks)', data: dailyData.map(d => Math.round(d.alcohol * 10) / 10), type: 'line', borderColor: '#DC2626', backgroundColor: 'transparent', tension: 0.3, pointRadius: 3, borderWidth: 1.5, borderDash: [3, 2], yAxisID: 'y2', fill: false });
    }

    return {
      type: 'bar',
      data: {
        labels: days.map(d => { const dt = new Date(d + 'T12:00:00'); return `${dt.getDate()}/${dt.getMonth() + 1}`; }),
        datasets
      },
      options: {
        ...this._defaultChartOptions(),
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, maxTicksLimit: 7 } },
          y: { position: 'left', grid: { color: '#F3F4F6' }, title: { display: true, text: 'Macros (g)', font: { size: 10 } } },
          y1: { position: 'right', grid: { display: false }, title: { display: true, text: 'Calories', font: { size: 10 } } },
          y2: { display: false }
        },
        plugins: { legend: this._consistentLegend() }
      }
    };
  },

  _buildMedChart(events) {
    const medOnly = events.filter(e => e.eventType === 'medication');
    const days = this._rangeDayLabels('medication');

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
            borderColor: '#10B981',
            borderRadius: 2, stack: 'am'
          },
          {
            label: 'AM Skipped',
            data: amSkipped,
            backgroundColor: 'rgba(239,68,68,0.7)',
            borderColor: '#EF4444',
            borderRadius: 2, stack: 'am'
          },
          {
            label: 'PM Taken',
            data: pmTaken,
            backgroundColor: 'rgba(0,179,183,0.7)',
            borderColor: '#00B3B7',
            borderRadius: 2, stack: 'pm'
          },
          {
            label: 'PM Skipped',
            data: pmSkipped,
            backgroundColor: 'rgba(245,158,11,0.8)',
            borderColor: '#F59E0B',
            borderRadius: 2, stack: 'pm'
          }
        ]
      },
      options: {
        ...this._defaultChartOptions(),
        plugins: {
          legend: this._consistentLegend(),
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
            ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 45, maxTicksLimit: 10 },
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

  _buildVentolinChart(events) {
    const ventOnly = events.filter(e => e.eventType === 'ventolin');
    const days = this._rangeDayLabels('ventolin');

    // Group by local date
    const byDay = {};
    ventOnly.forEach(e => {
      const dk = this._localDateKey(e.timestamp);
      if (!byDay[dk]) byDay[dk] = [];
      byDay[dk].push(e);
    });

    const preExData = [];
    const reliefData = [];
    // 7-day rolling total
    const rollingTotal = [];

    days.forEach((day, i) => {
      const dayEvents = byDay[day] || [];
      const pre = dayEvents.filter(e => (e.context || '').toLowerCase().startsWith('prevent')).length;
      const react = dayEvents.length - pre;
      preExData.push(pre);
      reliefData.push(react);

      // Rolling 7-day average
      const start = Math.max(0, i - 6);
      let sum = 0;
      for (let j = start; j <= i; j++) {
        const d = byDay[days[j]] || [];
        sum += d.length;
      }
      const window = i - start + 1;
      rollingTotal.push(window >= 7 ? +(sum / 7).toFixed(1) : null);
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
            label: 'Pre-Exercise',
            data: preExData,
            backgroundColor: 'rgba(59,130,246,0.7)',
            borderColor: '#3B82F6',
            borderRadius: 2,
            stack: 'uses'
          },
          {
            label: 'Symptom Relief',
            data: reliefData,
            backgroundColor: 'rgba(245,158,11,0.7)',
            borderColor: '#F59E0B',
            borderRadius: 2,
            stack: 'uses'
          },
          {
            label: '7-Day Avg',
            type: 'line',
            data: rollingTotal,
            borderColor: '#EF4444',
            borderWidth: 2,
            borderDash: [4, 3],
            pointRadius: 0,
            fill: false,
            tension: 0.3,
            spanGaps: true,
            order: 0
          }
        ]
      },
      options: {
        ...this._defaultChartOptions(),
        plugins: {
          legend: this._consistentLegend(),
          tooltip: {
            backgroundColor: '#1A1A2E',
            titleFont: { size: 12 },
            bodyFont: { size: 11 },
            callbacks: {
              afterBody(items) {
                const idx = items[0]?.dataIndex;
                if (idx == null) return '';
                const total = (preExData[idx] || 0) + (reliefData[idx] || 0);
                if (total === 0) return '\nNo usage';
                return `\nTotal: ${total} puff${total !== 1 ? 's' : ''}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 45, maxTicksLimit: 10 },
            stacked: true
          },
          y: {
            stacked: true,
            grid: { color: '#F3F4F6' },
            ticks: { font: { size: 10 }, stepSize: 1 },
            title: { display: true, text: 'Uses', font: { size: 10 } },
            beginAtZero: true
          }
        }
      }
    };
  },

  _buildSymptomChart(events) {
    const symptomEvents = events.filter(e => e.eventType === 'symptom');
    const days = this._rangeDayLabels('symptom');
    const byDay = {};
    symptomEvents.forEach(e => {
      const dk = this._localDateKey(e.timestamp);
      if (!byDay[dk]) byDay[dk] = [];
      byDay[dk].push(e);
    });
    const countData = days.map(day => (byDay[day] || []).length);
    const rollingAvg = [];
    days.forEach((_, i) => {
      const start = Math.max(0, i - 6);
      let sum = 0;
      for (let j = start; j <= i; j++) sum += countData[j] || 0;
      const window = i - start + 1;
      rollingAvg.push(window >= 7 ? +(sum / 7).toFixed(1) : null);
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
            label: 'Symptoms',
            data: countData,
            backgroundColor: 'rgba(0,179,183,0.6)',
            borderColor: '#00B3B7',
            borderRadius: 4,
            borderWidth: 1
          },
          {
            label: '7-Day Avg',
            type: 'line',
            data: rollingAvg,
            borderColor: '#F59E0B',
            borderWidth: 2,
            borderDash: [4, 3],
            pointRadius: 0,
            fill: false,
            tension: 0.3,
            spanGaps: true,
            order: 0
          }
        ]
      },
      options: {
        ...this._defaultChartOptions(),
        plugins: {
          legend: this._consistentLegend(),
          tooltip: {
            backgroundColor: '#1A1A2E',
            titleFont: { size: 12 },
            bodyFont: { size: 11 }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 45, maxTicksLimit: 10 } },
          y: { grid: { color: '#F3F4F6' }, ticks: { font: { size: 10 }, stepSize: 1 }, beginAtZero: true }
        }
      }
    };
  },

  _defaultChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
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
