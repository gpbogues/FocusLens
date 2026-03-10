import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Label } from 'recharts';
import './Home.css';

// Sample data for the focus session
const rawSessionData = [
  { label: 'Focused', duration: '1:58' },
  { label: 'Distracted', duration: '4:27' },
  { label: 'Focused', duration: '8:23' },
];

// Converts "M:SS" string to total numerical seconds
const timeToSeconds = (timeStr: string) => {
  const [min, sec] = timeStr.split(':').map(Number);
  return (min * 60) + sec;
};

const Home = () => {
  // Process data for the Pie (Donut) Chart
  const chartData = rawSessionData.reduce((acc: any[], curr) => {
    const seconds = timeToSeconds(curr.duration);
    const existing = acc.find(item => item.name === curr.label);
    if (existing) {
      existing.value += seconds;
    } else {
      acc.push({ name: curr.label, value: seconds });
    }
    return acc;
  }, []);

  // Constants & Calculations
  const COLORS = ['#82ca9d', '#ff8042']; // Green for Focused, Orange for Distracted
  const totalSeconds = rawSessionData.reduce((acc, curr) => acc + timeToSeconds(curr.duration), 0);
  
  // Calculate Focus Percentage for the center label
  const focusedData = chartData.find(d => d.name === 'Focused');
  const focusedSeconds = focusedData ? focusedData.value : 0;
  const focusPercentage = totalSeconds > 0 
    ? Math.round((focusedSeconds / totalSeconds) * 100) 
    : 0;

  // Used to track cumulative time for the timeline timestamps
  let currentAccumulator = 0;

  return (
    <div className="home-page">
      <h2 className="page-heading">Session Snapshots</h2>
      
      <div className="snapshots-placeholder">
        <div className="placeholder-card">
          
          {/* TOP SECTION: Info & Donut Chart */}
          <div className="card-top-row">
            <div className="card-info">
              <p className="placeholder-text">Session Efficiency</p>
              <p className="placeholder-subtext">
                Your focus ratio for this block. Hover for specific durations.
              </p>
            </div>

            <div className="card-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                    stroke="none"
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    
                    {/* Center Percentage Label */}
                    <Label 
                      value={`${focusPercentage}%`} 
                      position="center" 
                      fill="#fff" 
                      style={{ fontSize: '26px', fontWeight: 'bold' }} 
                    />
                    <Label 
                      value="Focused" 
                      position="center" 
                      dy={22} 
                      fill="#888" 
                      style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }} 
                    />
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#222', border: 'none', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: any) => {
                      const total = Number(value || 0);
                      return `${Math.floor(total / 60)}m ${total % 60}s`;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* BOTTOM SECTION: Timeline with End-of-Section Timestamps */}
          <div className="timeline-section">
            
            {/* Timestamps Above Bar */}
            <div className="timeline-labels-container" style={{ display: 'flex', width: '100%', marginBottom: '6px' }}>
              {rawSessionData.map((segment, index) => {
                const segmentSeconds = timeToSeconds(segment.duration);
                currentAccumulator += segmentSeconds;
                const widthPercent = (segmentSeconds / totalSeconds) * 100;

                return (
                  <div key={`label-${index}`} style={{ width: `${widthPercent}%`, textAlign: 'right', paddingRight: '2px' }}>
                    <span style={{ fontSize: '11px', color: '#666', fontFamily: 'monospace' }}>
                      {Math.floor(currentAccumulator / 60)}:{(currentAccumulator % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Sequential Flow Bar */}
            <div className="timeline-bar">
              {rawSessionData.map((segment, index) => (
                <div 
                  key={`segment-${index}`}
                  style={{
                    width: `${(timeToSeconds(segment.duration) / totalSeconds) * 100}%`,
                    backgroundColor: segment.label === 'Focused' ? '#82ca9d' : '#ff8042',
                    height: '100%',
                    borderRight: '2px solid #0a0a0a' // Visible divider
                  }}
                />
              ))}
            </div>

            {/* Start/Total/End Footer */}
            <div className="timeline-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
              <span style={{ fontSize: '11px', color: '#444', fontWeight: 'bold' }}>START</span>
              <span style={{ fontSize: '11px', color: '#888' }}>
                SESSION LENGTH: {Math.floor(totalSeconds / 60)}m {totalSeconds % 60}s
              </span>
              <span style={{ fontSize: '11px', color: '#444', fontWeight: 'bold' }}>END</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Home;