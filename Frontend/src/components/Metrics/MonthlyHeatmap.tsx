import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './MonthlyHeatmap.css';

interface DayData {
  day: string;
  sessionCount: number;
  totalDuration: number;
  avgFocus: number;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: DayData | null;
  dateLabel: string;
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getColorClass(count: number): string {
  if (count === 0) return 'hm-cell--empty';
  if (count === 1) return 'hm-cell--l1';
  if (count <= 3)  return 'hm-cell--l2';
  if (count <= 6)  return 'hm-cell--l3';
  return 'hm-cell--l4';
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatFocus(avg: number): string {
  // avgFocus is 0–3 scale; display as percentage
  return `${Math.round((avg / 3) * 100)}%`;
}

// Returns a grid of ISO date strings (or null for padding cells) laid out as
// columns = calendar weeks, rows = Mon–Sun (index 0–6).
function buildGrid(year: number, month: number): (string | null)[][] {
  const daysInMonth = new Date(year, month, 0).getDate();
  // Day of week of the 1st (0=Sun&6=Sat) into convert to Mon-based (0=Mon&6=Sun)
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = Array(firstDow).fill(null);

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    week.push(iso);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  return weeks;
}

const MonthlyHeatmap = () => {
  const { user } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dataMap, setDataMap] = useState<Record<string, DayData>>({});
  const [loading, setLoading] = useState(false);

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, data: null, dateLabel: '',
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.userId) return;
    setLoading(true);
    fetch(
      `${API_URL}/sessions/metrics/monthly/${user.userId}?year=${year}&month=${String(month).padStart(2, '0')}`,
      { credentials: 'include' }
    )
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          const map: Record<string, DayData> = {};
          for (const row of json.data) map[row.day] = row;
          setDataMap(map);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.userId, year, month]);

  function navigate(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m);
    setYear(y);
  }

  function handleMouseEnter(e: React.MouseEvent, iso: string) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cellRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      visible: true,
      x: cellRect.left - rect.left + cellRect.width / 2,
      y: cellRect.top  - rect.top,
      data: dataMap[iso] ?? null,
      dateLabel: new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      }),
    });
  }

  function handleMouseLeave() {
    setTooltip(t => ({ ...t, visible: false }));
  }

  const grid = buildGrid(year, month);

  return (
    <div className="hm-wrapper">
      <div className="hm-nav">
        <button className="hm-nav-btn" onClick={() => navigate(-1)} aria-label="Previous month">&#8249;</button>
        <span className="hm-nav-label">{MONTH_NAMES[month - 1]} {year}</span>
        <button
          className="hm-nav-btn"
          onClick={() => navigate(1)}
          disabled={year === now.getFullYear() && month === now.getMonth() + 1}
          aria-label="Next month"
        >
          &#8250;
        </button>
      </div>

      <div className="hm-graph" ref={containerRef}>
        {/* Day of week labels */}
        <div className="hm-dow-labels">
          {DAY_LABELS.map(d => (
            <span key={d} className="hm-dow-label">{d}</span>
          ))}
        </div>

        {/* Calendar grid: one column per week */}
        <div className="hm-grid">
          {grid.map((week, wi) => (
            <div key={wi} className="hm-week">
              {week.map((iso, di) => {
                if (!iso) return <div key={di} className="hm-cell hm-cell--pad" />;
                const count = dataMap[iso]?.sessionCount ?? 0;
                return (
                  <div
                    key={iso}
                    className={`hm-cell ${getColorClass(count)}`}
                    onMouseEnter={e => handleMouseEnter(e, iso)}
                    onMouseLeave={handleMouseLeave}
                    aria-label={`${iso}: ${count} session${count !== 1 ? 's' : ''}`}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Tooltip */}
        {tooltip.visible && (
          <div
            className="hm-tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <p className="hm-tooltip-date">{tooltip.dateLabel}</p>
            {tooltip.data ? (
              <>
                <p className="hm-tooltip-row">
                  <span className="hm-tooltip-label">Sessions</span>
                  <span className="hm-tooltip-value">{tooltip.data.sessionCount}</span>
                </p>
                <p className="hm-tooltip-row">
                  <span className="hm-tooltip-label">Duration</span>
                  <span className="hm-tooltip-value">{formatDuration(tooltip.data.totalDuration)}</span>
                </p>
                <p className="hm-tooltip-row">
                  <span className="hm-tooltip-label">Avg Focus</span>
                  <span className="hm-tooltip-value">{formatFocus(tooltip.data.avgFocus)}</span>
                </p>
              </>
            ) : (
              <p className="hm-tooltip-row">
                <span className="hm-tooltip-label">No sessions</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="hm-legend">
        <span className="hm-legend-label">Less</span>
        <div className="hm-cell hm-cell--empty hm-legend-cell" />
        <div className="hm-cell hm-cell--l1 hm-legend-cell" />
        <div className="hm-cell hm-cell--l2 hm-legend-cell" />
        <div className="hm-cell hm-cell--l3 hm-legend-cell" />
        <div className="hm-cell hm-cell--l4 hm-legend-cell" />
        <span className="hm-legend-label">More</span>
      </div>

      {loading && <p className="hm-loading">Loading...</p>}
    </div>
  );
};

export default MonthlyHeatmap;
