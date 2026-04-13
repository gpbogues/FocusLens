import { useAuth } from '../../context/AuthContext';
import { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import type { ChartConfiguration } from 'chart.js';
import './Metrics.css';

Chart.register(...registerables);

type Range = '7D' | '1M' | '1Y';

function getLabels(range: Range): string[] {
  if (range === '7D') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (range === '1M') return Array.from({ length: 30 }, (_, i) => `${i + 1}`);
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
}

const avg = (arr: number[]) =>
  arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface DayMetric {
  focus: number;
  eye: number;
  deep: number;
  duration: string;
  distractions: number;
}

function drawDiamond(canvas: HTMLCanvasElement, focus: number, eye: number, deep: number) {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, R = 88;
  ctx.clearRect(0, 0, W, H);

  const grid = 'rgba(255,255,255,0.06)';
  const pts4 = (r: number): [number, number][] => [
    [cx,       cy - R * r],
    [cx + R*r, cy        ],
    [cx,       cy + R * r],
    [cx - R*r, cy        ],
  ];

  [0.25, 0.5, 0.75, 1].forEach(r => {
    const p = pts4(r);
    ctx.beginPath();
    ctx.moveTo(p[0][0], p[0][1]);
    p.forEach(pt => ctx.lineTo(pt[0], pt[1]));
    ctx.closePath();
    ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.stroke();
  });

  pts4(1).forEach(pt => {
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(pt[0], pt[1]);
    ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.stroke();
  });

  const f = focus / 100, e = eye / 100, d = deep / 100;
  const poly: [number, number][] = [
    [cx,                     cy - R * f],
    [cx + R * e,             cy        ],
    [cx,                     cy + R * d],
    [cx - R * ((f+e+d) / 3), cy        ],
  ];

  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  poly.forEach(pt => ctx.lineTo(pt[0], pt[1]));
  ctx.closePath();
  ctx.fillStyle = 'rgba(124,111,247,0.18)'; ctx.fill();
  ctx.strokeStyle = '#7C6FF7'; ctx.lineWidth = 2; ctx.stroke();

  ['#7C6FF7', '#3ECFB2', '#F472B6', '#7C6FF7'].forEach((col, i) => {
    ctx.beginPath(); ctx.arc(poly[i][0], poly[i][1], 5, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = '#18181b'; ctx.lineWidth = 2; ctx.stroke();
  });

  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = '#71717a'; ctx.textAlign = 'center';
  ctx.fillText('Focus', cx,          cy - R - 10);
  ctx.fillText('Eye',   cx + R + 14, cy + 4);
  ctx.fillText('Deep',  cx,          cy + R + 16);
}

function DiamondWheel({ weekData }: { weekData: DayMetric[] }) {
  const [selected, setSelected] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const d = weekData[selected];

  useEffect(() => {
    if (canvasRef.current && d) {
      drawDiamond(canvasRef.current, d.focus, d.eye, d.deep);
    }
  }, [selected, d]);

  if (!d) return null;

  return (
    <div className="metrics-card">
      <div className="metrics-card-header">
        <div>
          <p className="metrics-section-label">Sessions</p>
          <h3 className="metrics-card-title">User sessions</h3>
        </div>
        <span className="metrics-day-name">{DAY_NAMES[selected]}</span>
      </div>

      <div className="metrics-wheel-body">
        <div className="metrics-wheel-canvas">
          <canvas
            ref={canvasRef}
            width={240} height={240}
            role="img"
            aria-label="Diamond chart showing focus, eye contact, and deep focus"
          />
        </div>

        <div className="metrics-wheel-bars">
          {[
            { label: 'Focus score', value: d.focus, cls: 'bar-purple' },
            { label: 'Eye contact', value: d.eye,   cls: 'bar-teal'   },
            { label: 'Deep focus',  value: d.deep,  cls: 'bar-pink'   },
          ].map(({ label, value, cls }) => (
            <div key={label} className="metrics-bar-row">
              <span className="metrics-bar-label">{label}</span>
              <div className="metrics-bar-track">
                <div className={`metrics-bar-fill ${cls}`} style={{ width: `${value}%` }} />
              </div>
              <span className={`metrics-bar-value ${cls}`}>{value}</span>
            </div>
          ))}

          <div className="metrics-wheel-stats">
            <div>
              <p className="metrics-stat-label">Duration</p>
              <p className="metrics-stat-value">{d.duration}</p>
            </div>
            <div>
              <p className="metrics-stat-label">Distractions</p>
              <p className={`metrics-stat-value ${d.distractions > 8 ? 'text-danger' : ''}`}>
                {d.distractions}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="metrics-day-tabs">
        {DAY_LABELS.map((label, i) => (
          <button
            key={i}
            className={`metrics-day-tab ${selected === i ? 'active' : ''}`}
            onClick={() => setSelected(i)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

const Metrics = () => {
  const { user } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;
  const [range, setRange]         = useState<Range>('7D');
  const [focusData, setFocusData] = useState<number[]>([]);
  const [eyeData,   setEyeData]   = useState<number[]>([]);
  const [weekData,  setWeekData]  = useState<DayMetric[]>([]);
  const [loading,   setLoading]   = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
  if (!user) return;
  const fetchLineData = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/metrics/focus-over-time/${user.userId}?range=${range}`,
        { credentials: 'include' }
      );
      const json = await res.json();
      if (json.success) {
  if (json.data.length > 0) {
    setFocusData(json.data.map((d: any) => Math.round(d.focusScore || 0)));
    setEyeData(json.data.map((d: any) => Math.round(d.focusScore || 0)));
  } else {
    setLoading(false);
  }
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
  if (!user) return;
  const fetchWeekData = async () => {
    try {
      const res = await fetch(
        `${API_URL}/metrics/weekly-summary/${user.userId}`,
        { credentials: 'include' }
      );
      const json = await res.json();
      if (json.success) setWeekData(json.data);
    } catch (err) {
      console.error('Failed to fetch weekly data:', err);
    }
  };
  fetchWeekData();
}, [user]);

  useEffect(() => {
    if (!canvasRef.current || focusData.length === 0) return;
    chartRef.current?.destroy();

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: getLabels(range),
        datasets: [
          {
            label: 'Focus Score',
            data: focusData,
            borderColor: '#7C6FF7',
            backgroundColor: 'rgba(124,111,247,0.15)',
            fill: true, tension: 0.45, pointRadius: 3,
            pointBackgroundColor: '#7C6FF7',
            pointBorderColor: '#0f0f10', pointBorderWidth: 2, borderWidth: 2,
          },
          {
            label: 'Eye Contact %',
            data: eyeData,
            borderColor: '#3ECFB2',
            backgroundColor: 'rgba(62,207,178,0.12)',
            fill: true, tension: 0.45, pointRadius: 3,
            pointBackgroundColor: '#3ECFB2',
            pointBorderColor: '#0f0f10', pointBorderWidth: 2, borderWidth: 2,
            borderDash: [5, 3],
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e1e24', borderColor: '#2a2a30', borderWidth: 1,
            titleColor: '#f4f4f5', bodyColor: '#71717a', padding: 12,
            callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${Math.round(ctx.raw as number)}` },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#71717a', font: { size: 11 }, maxTicksLimit: range === '1M' ? 10 : undefined },
            border: { color: '#2a2a30' },
          },
          y: {
            min: 40, max: 100,
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#71717a', font: { size: 11 }, stepSize: 20 },
            border: { color: '#2a2a30' },
          },
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, config);
    return () => chartRef.current?.destroy();
  }, [focusData, eyeData, range]);

  return (
    <div className="metrics-page">
      <div className="metrics-header">
        <h2 className="page-heading">Metrics</h2>
      </div>

      <div className="metrics-section">
        <div className="metrics-card">
          <div className="metrics-card-header">
            <div>
              <p className="metrics-section-label">Monthly review</p>
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
              { label: 'Avg focus',       value: `${avg(focusData)}`, unit: '/100' },
              { label: 'Avg eye contact', value: `${avg(eyeData)}`,   unit: '%'    },
              { label: 'Sessions',        value: `${range === '7D' ? 12 : range === '1M' ? 48 : 194}`, unit: '' },
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
            {[
              { label: 'Focus score',   color: '#7C6FF7', dashed: false },
              { label: 'Eye contact %', color: '#3ECFB2', dashed: true  },
            ].map(({ label, color, dashed }) => (
              <div key={label} className="metrics-legend-item">
                <svg width="22" height="10" viewBox="0 0 22 10">
                  <line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '5 3' : 'none'} />
                </svg>
                <span>{label}</span>
              </div>
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
        <DiamondWheel weekData={weekData} />
      </div>
    </div>
  );
};

export default Metrics;