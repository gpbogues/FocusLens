import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Chart, registerables } from 'chart.js';
import type { ChartConfiguration } from 'chart.js';
import './Metrics.css';
import MonthlyHeatmap from './MonthlyHeatmap';

interface FocusDataPoint {
  date: string;
  focusScore: number;
  sessionCount: number;
}

interface FocusResponse {
  success: boolean;
  data: FocusDataPoint[];
}

Chart.register(...registerables);

type Range  = '7D' | '1M' | '1Y' | 'custom';
type Metric = 'focus' | 'time' | 'sessions';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function getLabels(range: Range): string[] {
  if (range === '7D') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (range === '1M') return Array.from({ length: 30 }, (_, i) => `${i + 1}`);
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
}

const avg = (arr: number[]) =>
  arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function fmtShort(dateStr: string): string {
  const [, m, day] = dateStr.split('-');
  return `${MONTHS[+m - 1]} ${+day}`;
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayStr(): string {
  const t = new Date();
  return toDateStr(t.getFullYear(), t.getMonth(), t.getDate());
}

const Metrics = () => {
  const { user } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;

  const [range, setRange]                 = useState<Range>('7D');
  const [focusData, setFocusData]         = useState<number[]>([]);
  const [durationData, setDurationData]   = useState<number[]>([]);
  const [sessionData, setSessionData]     = useState<number[]>([]);
  const [chartLabels, setChartLabels]     = useState<string[]>([]);
  const [sessionCount, setSessionCount]   = useState<number | null>(null);
  const [totalDuration, setTotalDuration] = useState<number | null>(null);
  const [loading, setLoading]             = useState(true);
  const [activeMetric, setActiveMetric]   = useState<Metric>('focus');

  // Custom date range state
  const [customStart,   setCustomStart]   = useState<string | null>(null);
  const [customEnd,     setCustomEnd]     = useState<string | null>(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [csvConfirm, setCsvConfirm] = useState(false);
  const [pickStep,      setPickStep]      = useState<'start' | 'end'>('start');
  const [calYear,       setCalYear]       = useState(() => new Date().getFullYear());
  const [calMonth,      setCalMonth]      = useState(() => new Date().getMonth());
  // Pending selections inside the modal (committed only on Confirm)
  const [pendingStart,  setPendingStart]  = useState<string | null>(null);
  const [pendingEnd,    setPendingEnd]    = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!user) return;
    if (range === 'custom' && (!customStart || !customEnd)) return;

    const fetchLineData = async () => {
      setLoading(true);
      setSessionCount(null);
      setTotalDuration(null);
      setChartLabels([]);
      setFocusData([]);
      setDurationData([]);
      setSessionData([]);
      try {
        const url = range === 'custom'
          ? `${API_URL}/metrics/focus-over-time/${user.userId}?start=${customStart}&end=${customEnd}`
          : `${API_URL}/metrics/focus-over-time/${user.userId}?range=${range}`;
        const res = await fetch(url, { credentials: 'include' });
        const json: FocusResponse = await res.json();
        if (json.success && json.data.length > 0) {
          setChartLabels(json.data.map((d: any) => d.date));
          setFocusData(json.data.map((d: any) => Math.round(d.focusScore || 0)));
          setDurationData(json.data.map((d: any) => Math.round((d.totalDuration || 0) / 60)));
          setSessionData(json.data.map((d: any) => d.sessionCount || 0));
          setSessionCount(json.data.reduce((sum: number, d: any) => sum + (d.sessionCount || 0), 0));
          setTotalDuration(json.data.reduce((sum: number, d: any) => sum + (d.totalDuration || 0), 0));
        }
      } catch (err) {
        console.error('Failed to fetch focus data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLineData();
  }, [range, user, customStart, customEnd]);

  useEffect(() => {
    if (!canvasRef.current || focusData.length === 0) return;
    chartRef.current?.destroy();

    const accent   = cssVar('--color-accent')      || '#646cff';
    const muted    = cssVar('--color-text-muted')  || '#6b7280';
    const border   = cssVar('--color-border')      || '#404040';
    const bright   = cssVar('--color-text-bright') || '#e5e7eb';
    const elevated = cssVar('--color-bg-elevated') || '#242424';
    const orange   = '#f59e0b';
    const blue     = '#3b82f6';

    const metricConfig = {
      focus:    { data: focusData,    color: accent,  dash: [],     label: 'Avg Focus'  },
      time:     { data: durationData, color: orange,  dash: [5, 3], label: 'Total Time' },
      sessions: { data: sessionData,  color: blue,    dash: [2, 4], label: 'Sessions'   },
    }[activeMetric];

    const rawMax = metricConfig.data.length > 0 ? Math.max(...metricConfig.data) : 100;
    const yMax   = Math.max(Math.ceil(rawMax * 1.15 / 5) * 5, 5);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: chartLabels.length ? chartLabels : getLabels(range),
        datasets: [{
          label: metricConfig.label,
          data: metricConfig.data,
          borderColor: metricConfig.color,
          backgroundColor: metricConfig.color + '26',
          fill: true, tension: 0.45, pointRadius: 3,
          pointBackgroundColor: metricConfig.color,
          pointBorderColor: elevated,
          pointBorderWidth: 2, borderWidth: 2,
          borderDash: metricConfig.dash,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: cssVar('--color-bg-surface') || '#1a1a1a',
            borderColor: border, borderWidth: 1,
            titleColor: bright, bodyColor: muted, padding: 12,
            callbacks: {
              label: (ctx: any) => {
                const val = Math.round(ctx.raw as number);
                if (activeMetric === 'focus')    return ` Avg Focus: ${val}%`;
                if (activeMetric === 'sessions') return ` Sessions: ${val}`;
                const h = Math.floor(val / 60);
                const m = val % 60;
                return ` Total Time: ${h > 0 ? `${h}h ${m}m` : `${m}m`}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: border + '44' },
            ticks: { color: muted, font: { size: 11 }, maxTicksLimit: range === '1M' ? 10 : undefined },
            border: { color: border },
          },
          y: {
            min: 0,
            max: yMax,
            grid: { color: border + '44' },
            ticks: {
              color: muted, font: { size: 11 },
              callback: (v: any) => {
                if (activeMetric === 'time') {
                  const h = Math.floor((v as number) / 60);
                  const m = (v as number) % 60;
                  return h > 0 ? `${h}h ${m}m` : `${m}m`;
                }
                return v;
              },
            },
            border: { color: border },
          },
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, config);
    return () => chartRef.current?.destroy();
  }, [focusData, durationData, sessionData, range, activeMetric, chartLabels]);

  // Calendar helpers
  function openDateModal() {
    // Pre-populate pending with confirmed values so user can edit
    setPendingStart(customStart);
    setPendingEnd(customEnd);
    setPickStep(customStart ? 'end' : 'start');
    if (customStart) {
      const [y, m] = customStart.split('-').map(Number);
      setCalYear(y);
      setCalMonth(m - 1);
    } else {
      setCalYear(new Date().getFullYear());
      setCalMonth(new Date().getMonth());
    }
    setShowDateModal(true);
  }

  function prevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  }

  function nextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  }

  function handleDayClick(dateStr: string) {
    if (dateStr > todayStr()) return;
    // Clicking a selected date deselects it
    if (dateStr === pendingEnd) {
      setPendingEnd(null);
      setPickStep('end');
      return;
    }
    if (dateStr === pendingStart) {
      setPendingStart(null);
      setPendingEnd(null);
      setPickStep('start');
      return;
    }
    if (pickStep === 'start') {
      setPendingStart(dateStr);
      setPendingEnd(null);
      setPickStep('end');
    } else {
      if (!pendingStart || dateStr < pendingStart) {
        // Clicked before start: reset, treat as new start
        setPendingStart(dateStr);
        setPendingEnd(null);
      } else {
        setPendingEnd(dateStr);
      }
    }
  }

  function confirmDates() {
    if (!pendingStart || !pendingEnd) return;
    setCustomStart(pendingStart);
    setCustomEnd(pendingEnd);
    setRange('custom');
    setShowDateModal(false);
  }

  function cancelModal() {
    setShowDateModal(false);
  }

  // Build calendar day grid
  function buildCalendarDays() {
    const firstDow = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrev  = new Date(calYear, calMonth, 0).getDate();
    const today = todayStr();

    const cells: { dateStr: string; day: number; otherMonth: boolean }[] = [];

    // Leading days from previous month
    for (let i = firstDow - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      const m = calMonth === 0 ? 11 : calMonth - 1;
      const y = calMonth === 0 ? calYear - 1 : calYear;
      cells.push({ dateStr: toDateStr(y, m, d), day: d, otherMonth: true });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ dateStr: toDateStr(calYear, calMonth, d), day: d, otherMonth: false });
    }

    // Trailing days from next month
    const trailing = 42 - cells.length;
    for (let d = 1; d <= trailing; d++) {
      const m = calMonth === 11 ? 0 : calMonth + 1;
      const y = calMonth === 11 ? calYear + 1 : calYear;
      cells.push({ dateStr: toDateStr(y, m, d), day: d, otherMonth: true });
    }

    return cells.map(({ dateStr, day, otherMonth }) => {
      const isDisabled  = dateStr > today;
      const isStart     = dateStr === pendingStart;
      const isEnd       = dateStr === pendingEnd;
      const isToday     = dateStr === today;
      const inRange     = pendingStart && pendingEnd
        && dateStr > pendingStart && dateStr < pendingEnd;

      const classes = [
        'cal-day',
        otherMonth  ? 'other-month'      : '',
        isDisabled  ? 'disabled'         : '',
        isStart     ? 'selected-start'   : '',
        isEnd       ? 'selected-end'     : '',
        inRange     ? 'in-range'         : '',
        isToday && !isStart && !isEnd ? 'today' : '',
      ].filter(Boolean).join(' ');

      return (
        <button
          key={dateStr}
          className={classes}
          onClick={() => !isDisabled && handleDayClick(dateStr)}
          disabled={isDisabled}
          type="button"
        >
          {day}
        </button>
      );
    });
  }

  function downloadCSV() {
    if (!chartLabels.length) return;
    const rows = [['Date', 'Avg Focus (%)', 'Total Time (min)', 'Sessions']];
    chartLabels.forEach((date, i) => {
      rows.push([date, String(focusData[i] ?? ''), String(durationData[i] ?? ''), String(sessionData[i] ?? '')]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `focuslens-metrics-${range === 'custom' ? `${customStart}_${customEnd}` : range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sectionLabel =
    range === '7D'    ? '7 day review'
    : range === '1M'  ? 'Monthly review'
    : range === '1Y'  ? 'Yearly review'
    : customStart && customEnd
      ? `${fmtShort(customStart)} – ${fmtShort(customEnd)}`
      : 'Custom range';

  return (
    <div className="metrics-page">
      <div className="metrics-header">
        <h2 className="page-heading">Metrics</h2>
      </div>

      <div className="metrics-section">
        <div className="metrics-card">
          <div className="metrics-card-header">
            <div>
              <p className="metrics-section-label">{sectionLabel}</p>
              <h3 className="metrics-card-title">Focus over time</h3>
            </div>
            <div className="metrics-range-toggle">
              {(['7D', '1M', '1Y'] as Range[]).map(r => (
                <button
                  key={r}
                  className={`metrics-range-btn ${range === r ? 'active' : ''}`}
                  onClick={() => setRange(r)}
                >
                  {r}
                </button>
              ))}
              <button
                className={`metrics-range-btn ${range === 'custom' ? 'active' : ''}`}
                onClick={openDateModal}
              >
                {range === 'custom' && customStart && customEnd
                  ? `${fmtShort(customStart)} – ${fmtShort(customEnd)}`
                  : 'Custom'}
              </button>
              <button
                className="metrics-range-btn metrics-csv-btn"
                onClick={() => chartLabels.length && setCsvConfirm(true)}
                disabled={!chartLabels.length}
                title="Download as CSV"
              >
                CSV
              </button>
            </div>
          </div>

          <div className="metrics-stat-cards">
            {[
              {
                label: 'Avg focus',
                value: focusData.length ? `${avg(focusData)}` : '-',
                unit:  focusData.length ? '%' : '',
              },
              {
                label: 'Total time',
                value: totalDuration !== null ? formatDuration(totalDuration) : '-',
                unit:  '',
              },
              {
                label: 'Sessions',
                value: sessionCount !== null ? `${sessionCount}` : '-',
                unit:  '',
              },
            ].map(({ label, value, unit }) => (
              <div key={label} className="metrics-stat-card">
                <p className="metrics-stat-label">{label}</p>
                <p className="metrics-stat-number">
                  {value}<span className="metrics-stat-unit">{unit}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="metrics-legend">
            {([
              { key: 'focus',    label: 'Avg focus',  color: 'var(--color-accent)', dash: undefined },
              { key: 'time',     label: 'Total time', color: '#f59e0b',             dash: '5 3'     },
              { key: 'sessions', label: 'Sessions',   color: '#3b82f6',             dash: '2 4'     },
            ] as const).map(({ key, label, color, dash }) => (
              <button
                key={key}
                className={`metrics-legend-item metrics-legend-btn ${activeMetric !== key ? 'legend-off' : ''}`}
                onClick={() => setActiveMetric(key)}
              >
                <svg width="22" height="10" viewBox="0 0 22 10">
                  <line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2" strokeDasharray={dash} />
                </svg>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="metrics-loading">Loading...</div>
          ) : (
            <div className="metrics-chart-wrap">
              <canvas ref={canvasRef} role="img" aria-label={`Line chart over ${range}`}>
                Focus and eye contact metrics over time.
              </canvas>
            </div>
          )}
        </div>
      </div>

      <div className="metrics-section">
        <MonthlyHeatmap />
      </div>

      {/* CSV Download Confirmation */}
      {csvConfirm && (
        <div className="modal-overlay" onClick={() => setCsvConfirm(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <p className="modal-title">Download CSV</p>
            <p className="modal-subtitle">Export {chartLabels.length} row{chartLabels.length !== 1 ? 's' : ''} of metrics data for the {sectionLabel}?</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setCsvConfirm(false)}>Cancel</button>
              <button className="modal-save" onClick={() => { downloadCSV(); setCsvConfirm(false); }}>Download</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Date Range Modal */}
      {showDateModal && (
        <div className="modal-overlay" onClick={cancelModal}>
          <div className="date-modal-box" onClick={e => e.stopPropagation()}>
            <p className="date-modal-title">Select date range</p>
            <p className="date-modal-step-label">
              {pickStep === 'start'
                ? 'Select a start date'
                : pendingEnd
                  ? `${fmtShort(pendingStart!)} → ${fmtShort(pendingEnd)}`
                  : `Start: ${fmtShort(pendingStart!)} — now select end date`}
            </p>

            <div className="cal-header">
              <button className="cal-nav-btn" onClick={prevMonth} type="button">&#8249;</button>
              <span className="cal-month-label">{MONTHS[calMonth]} {calYear}</span>
              <button className="cal-nav-btn" onClick={nextMonth} type="button">&#8250;</button>
            </div>

            <div className="cal-weekdays">
              {WEEKDAYS.map(d => <span key={d}>{d}</span>)}
            </div>

            <div className="cal-grid">
              {buildCalendarDays()}
            </div>

            <div className="date-modal-footer">
              <button className="modal-cancel" onClick={cancelModal} type="button">Cancel</button>
              <button
                className="modal-save"
                onClick={confirmDates}
                disabled={!pendingStart || !pendingEnd}
                type="button"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Metrics;
