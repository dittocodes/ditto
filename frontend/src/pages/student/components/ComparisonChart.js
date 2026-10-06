import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PIE_COLORS = ['#2563eb', '#60a5fa', '#1d4ed8', '#93c5fd', '#3b82f6', '#64748b'];

const chartGrid = <CartesianGrid strokeDasharray="3 3" vertical={false} />;

export default function ComparisonChart({ chartType, chartData, dark = false }) {
  if (!chartData.length) {
    return <p className="tracker-comparison-chart-empty">No comparison data yet.</p>;
  }

  const height = 260;
  const tickFill = dark ? '#ffffff' : undefined;
  const gridStroke = dark ? '#dce5ef' : undefined;
  const axisProps = dark
    ? { tick: { fill: '#ffffff', fontSize: 12 }, axisLine: false, tickLine: false }
    : { tick: { fontSize: 10 } };

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="4 5" vertical={!!dark} stroke={gridStroke || undefined} />
          <XAxis dataKey="name" {...axisProps} interval={0} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} {...axisProps} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="previous" stroke="#9baabd" strokeWidth={3} dot={{ r: 4 }} name="Previous" />
          <Line type="monotone" dataKey="current" stroke="#3985ee" strokeWidth={3} dot={{ r: 4 }} name="Current" />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'radar') {
    const radarData = chartData.map((row) => ({
      subject: row.name,
      Previous: row.previous ?? 0,
      Current: row.current ?? 0,
    }));
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#64748b' }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
          <Radar name="Previous" dataKey="Previous" stroke="#94a3b8" fill="#cbd5e1" fillOpacity={0.4} />
          <Radar name="Current" dataKey="Current" stroke="#2563eb" fill="#2563eb" fillOpacity={0.35} />
          <Legend />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          {chartGrid}
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Area
            type="monotone"
            dataKey="previous"
            stroke="#94a3b8"
            fill="#cbd5e1"
            fillOpacity={0.5}
            name="Previous"
          />
          <Area
            type="monotone"
            dataKey="current"
            stroke="#2563eb"
            fill="#2563eb"
            fillOpacity={0.25}
            name="Current"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'pie') {
    const pieCurrent = chartData.map((row) => ({ name: row.name, value: row.current ?? 0 }));
    const piePrevious = chartData.map((row) => ({ name: row.name, value: row.previous ?? 0 }));
    return (
      <div className="tracker-comparison-pie-row">
        <div className="tracker-comparison-pie-cell">
          <span className="tracker-comparison-pie-label">Previous period</span>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={piePrevious} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={64}>
                {piePrevious.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="tracker-comparison-pie-cell">
          <span className="tracker-comparison-pie-label">Current period</span>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieCurrent} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={64}>
                {pieCurrent.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="4 5" vertical={!!dark} stroke={gridStroke || undefined} />
        <XAxis dataKey="name" {...axisProps} interval={0} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} {...axisProps} />
        <Tooltip cursor={dark ? { fill: 'rgba(255,255,255,0.08)' } : undefined} />
        <Legend wrapperStyle={dark ? { color: '#fff' } : undefined} />
        <Bar dataKey="previous" fill="#9baabd" name="Previous" radius={[4, 4, 0, 0]} barSize={38} />
        <Bar dataKey="current" fill="#3985ee" name="Current" radius={[4, 4, 0, 0]} barSize={38} />
      </BarChart>
    </ResponsiveContainer>
  );
}
