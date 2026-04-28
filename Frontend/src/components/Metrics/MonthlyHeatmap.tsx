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
  data: DayData | null;
  dateLabel: string;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

// avgFocus is between 0 and 3, so convert to percentage for display
function formatFocus(avg: number): string {
  return `${Math.round((avg / 3) * 100)}%`;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MonthlyHeatmap = () => {
  const { user } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;

  const now = new Date();
  const [dataMap, setDataMap] = useState<Record<string, DayData>>({});
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, data: null, dateLabel: '',
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const endDate   = new Date(now);
  const startDate = new Date(now);
  startDate.setFullYear(startDate.getFullYear() - 1);
  // Shift startDate back to the nearest Monday so the grid always begins on a full week
  const dow = startDate.getDay();
  const daysToMon = dow === 0 ? 6 : dow - 1;
  startDate.setDate(startDate.getDate() - daysToMon);

  useEffect(() => {
    if (!user?.userId) return;
    const monthsNeeded = new Set<string>();
    const d = new Date(startDate);
    while (d <= endDate) {
      monthsNeeded.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
      d.setMonth(d.getMonth() + 1);
    }
    setLoading(true);
    Promise.all(
      Array.from(monthsNeeded).map(ym => {
        const [y, m] = ym.split('-');
        return fetch(
          `${API_URL}/sessions/metrics/monthly/${user.userId}?year=${y}&month=${m}`,
          { credentials: 'include' }
        ).then(r => r.json()).catch(() => ({ success: false, data: [] }));
      })
    ).then(results => {
      const map: Record<string, DayData> = {};
      for (const json of results) {
        if (json.success) {
          for (const row of json.data) map[row.day] = row;
        }
      }
      setDataMap(map);
    }).finally(() => setLoading(false));
  }, [user?.userId]);

  const totalDays  = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const totalWeeks = Math.ceil(totalDays / 7);

  const monthStartCols = new Map<number, string>();
  let lastMonth = -1;
  for (let col = 0; col < totalWeeks; col++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + col * 7);
    if (d.getMonth() !== lastMonth) {
      lastMonth = d.getMonth();
      if (col > 0) monthStartCols.set(col, MONTH_NAMES[d.getMonth()]);
    }
  }

  const todayStr = toDateStr(now);

  function handleMouseEnter(iso: string) {
    setTooltip({
      visible: true,
      data: dataMap[iso] ?? null,
      dateLabel: new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      }),
    });
  }

  function handleMouseLeave() {
    setTooltip(t => ({ ...t, visible: false }));
  }

  return (
    <div className="hm-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
        <div>
          <p className="hm-section-label">Activity</p>
          <h3 className="hm-title">Session heatmap</h3>
        </div>
      </div>

      <div style={{ display: 'flex', width: '100%', gap: 16, alignItems: 'flex-start' }}>

        <div
          ref={containerRef}
          style={{
            flex: 1,
            minWidth: 0,
            display: 'grid',
            gridTemplateColumns: `32px repeat(${totalWeeks}, 1fr)`,
            gap: 2,
          }}
        >
          
          <div style={{ height: 22 }} />
          {Array.from({ length: totalWeeks }, (_, col) => (
            <div key={`ml-${col}`} style={{ height: 22, overflow: 'visible', position: 'relative' }}>
              {monthStartCols.has(col) && (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', position: 'absolute' }}>
                  {monthStartCols.get(col)}
                </span>
              )}
            </div>
          ))}

          {DAY_LABELS.flatMap((dayLabel, row) => [
            <span key={`dow-${row}`} className="hm-dow-label">{dayLabel}</span>,
            ...Array.from({ length: totalWeeks }, (_, col) => {
              const d = new Date(startDate);
              d.setDate(d.getDate() + col * 7 + row);
              if (d > endDate) return <div key={`sp-${col}-${row}`} className="hm-cell hm-cell--spacer" />;
              const iso   = toDateStr(d);
              const count = dataMap[iso]?.sessionCount ?? 0;
              const isToday = iso === todayStr;
              return (
                <div
                  key={iso}
                  className={`hm-cell ${getColorClass(count)}${isToday ? ' hm-cell--today' : ''}`}
                  onMouseEnter={() => handleMouseEnter(iso)}
                  onMouseLeave={handleMouseLeave}
                  aria-label={`${iso}: ${count} session${count !== 1 ? 's' : ''}`}
                />
              );
            }),
          ])}
        </div>

        <div style={{
          width: 160,
          flexShrink: 0,
          background: 'var(--color-bg-surface)',
          border: '0.5px solid var(--color-border)',
          borderRadius: 10,
          padding: '12px 14px',
          minHeight: 90,
        }}>
          {tooltip.visible ? (
            <>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px', lineHeight: 1.4 }}>{tooltip.dateLabel}</p>
              {tooltip.data ? (
                <>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Sessions</span><span style={{ color: '#7F77DD', fontWeight: 600 }}>{tooltip.data.sessionCount}</span>
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Duration</span><span style={{ color: '#7F77DD', fontWeight: 600 }}>{formatDuration(tooltip.data.totalDuration)}</span>
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Focus</span><span style={{ color: '#7F77DD', fontWeight: 600 }}>{formatFocus(tooltip.data.avgFocus)}</span>
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>No sessions</p>
              )}
            </>
          ) : (
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>Hover over a day to see details</p>
          )}
        </div>
      </div>

      <div className="hm-legend">
        <span className="hm-legend-label">Less</span>
        <div className="hm-cell hm-cell--empty hm-legend-cell" />
        <div className="hm-cell hm-cell--l1 hm-legend-cell" />
        <div className="hm-cell hm-cell--l2 hm-legend-cell" />
        <div className="hm-cell hm-cell--l3 hm-legend-cell" />
        <div className="hm-cell hm-cell--l4 hm-legend-cell" />
        <span className="hm-legend-label">More</span>
      </div>

      {loading && <p className="hm-loading">Loading…</p>}
    </div>
  );
};

export default MonthlyHeatmap;
