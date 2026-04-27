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

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
    visible: false, x: 0, y: 0, data: null, dateLabel: '',
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Build rolling 52-week window ending today, starting on Monday
  const endDate   = new Date(now);
  const startDate = new Date(now);
  startDate.setFullYear(startDate.getFullYear() - 1);
  // Back to Monday
  const dow = startDate.getDay();
  const daysToMon = dow === 0 ? 6 : dow - 1;
  startDate.setDate(startDate.getDate() - daysToMon);

  useEffect(() => {
    if (!user?.userId) return;
    // Fetch all months in our window
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

  // Build grid: columns = weeks (Mon-Sun), rows = day of week
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const totalWeeks = Math.ceil(totalDays / 7);

  // Month labels
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let col = 0; col < totalWeeks; col++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + col * 7);
    if (d.getMonth() !== lastMonth) {
      lastMonth = d.getMonth();
      monthLabels.push({
        col,
        label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()],
      });
    }
  }

  const todayStr = toDateStr(now);

  function handleMouseEnter(e: React.MouseEvent, iso: string) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cellRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      visible: true,
      x: cellRect.left - rect.left + cellRect.width / 2,
      y: cellRect.top - rect.top,
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
        <div>
          <p className="hm-section-label">Activity</p>
          <h3 className="hm-title">Session heatmap</h3>
        </div>
      </div>

      {/* Main body: centered grid + right info panel */}
      <div style={{ display: 'flex', width: '100%', gap: 24, alignItems: 'flex-start' }}>

        {/* Centered grid */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div ref={containerRef}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {/* Day labels */}
              <div className="hm-dow-labels" style={{ paddingTop: 20 }}>
                {DAY_LABELS.map(d => (
                  <span key={d} className="hm-dow-label">{d}</span>
                ))}
              </div>

              {/* Grid + month labels */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{ height: 20, position: 'relative', marginBottom: 4 }}>
                  {monthLabels.slice(1).map(({ col, label }) => (
                    <div
                      key={col}
                      style={{
                        position: 'absolute',
                        left: col * 16,
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </div>
                  ))}
                </div>
                <div className="hm-grid">
                  {Array.from({ length: totalWeeks }, (_, col) => (
                    <div key={col} className="hm-week">
                      {Array.from({ length: 7 }, (_, row) => {
                        const d = new Date(startDate);
                        d.setDate(d.getDate() + col * 7 + row);
                        if (d > endDate) return <div key={row} className="hm-cell hm-cell--pad" />;
                        const iso   = toDateStr(d);
                        const count = dataMap[iso]?.sessionCount ?? 0;
                        const isToday = iso === todayStr;
                        return (
                          <div
                            key={iso}
                            className={`hm-cell ${getColorClass(count)}`}
                            style={isToday ? { outline: '1px solid #7F77DD', outlineOffset: '1px' } : undefined}
                            onMouseEnter={e => handleMouseEnter(e, iso)}
                            onMouseLeave={handleMouseLeave}
                            aria-label={`${iso}: ${count} session${count !== 1 ? 's' : ''}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed right info panel */}
        <div style={{
          width: 160,
          flexShrink: 0,
          background: 'var(--color-bg-surface)',
          border: '0.5px solid var(--color-border)',
          borderRadius: 10,
          padding: '12px 14px',
          minHeight: 90,
          marginRight: 100,
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
                    <span>Avg Focus</span><span style={{ color: '#7F77DD', fontWeight: 600 }}>{formatFocus(tooltip.data.avgFocus)}</span>
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

      {loading && <p className="hm-loading">Loading…</p>}
    </div>
  );
};

export default MonthlyHeatmap;