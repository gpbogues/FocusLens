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

type Range  = '7D' | '1M' | '1Y';
type Metric = 'focus' | 'time' | 'sessions';

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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchLineData = async () => {
      setLoading(true);
      setSessionCount(null);
      setTotalDuration(null);
      setChartLabels([]);
      setFocusData([]);
      setDurationData([]);
      setSessionData([]);
      try {
        const res = await fetch(
          `${API_URL}/metrics/focus-over-time/${user.userId}?range=${range}`,
          { credentials: 'include' }
        );
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
  }, [range, user]);

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

  return (
    <div className="metrics-page">
      <div className="metrics-header">
        <h2 className="page-heading">Metrics</h2>
      </div>

      <div className="metrics-section">
        <div className="metrics-card">
          <div className="metrics-card-header">
            <div>
              <p className="metrics-section-label">
                {range === '7D' ? '7 day review' : range === '1M' ? 'Monthly review' : 'Yearly review'}
              </p>
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
    </div>
  );
};

export default Metrics;