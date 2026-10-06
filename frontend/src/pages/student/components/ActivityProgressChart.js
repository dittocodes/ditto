import React from 'react';
import {
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

const PIE_COLORS = ['#2563eb', '#60a5fa', '#93c5fd', '#cbd5e1'];

const chartGrid = <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />;

function buildActivityRows(activityProgress) {
  const months = activityProgress?.months || [];
  const total = activityProgress?.total || [];
  const completed = activityProgress?.completed || [];
  return months.map((month, i) => ({
    month,
    total: total[i] ?? 0,
    completed: completed[i] ?? 0,
  }));
}

export default function ActivityProgressChart({ chartType, activityProgress }) {
  const chartData = buildActivityRows(activityProgress);

  if (!chartData.length) {
    return <p className="tracker-comparison-chart-empty">No activity progress data yet.</p>;
  }

  const height = 280;

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData}>
          {chartGrid}
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Line type="monotone" dataKey="total" stroke="#cbd5e1" strokeWidth={2} name="Total Activities" dot={{ r: 3 }} />
          <Line type="monotone" dataKey="completed" stroke="#2563eb" strokeWidth={2} name="Completed" dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'pie') {
    const pieData = chartData.map((row) => ({ name: row.month, value: row.completed ?? 0 }));
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
            {pieData.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'radar') {
    const radarData = chartData.map((row) => ({
      subject: row.month,
      Total: row.total ?? 0,
      Completed: row.completed ?? 0,
    }));
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
          <PolarRadiusAxis angle={30} allowDecimals={false} />
          <Radar name="Total Activities" dataKey="Total" stroke="#cbd5e1" fill="#cbd5e1" fillOpacity={0.4} />
          <Radar name="Completed" dataKey="Completed" stroke="#2563eb" fill="#2563eb" fillOpacity={0.35} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} barGap={4} barCategoryGap="18%">
        {chartGrid}
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="total" fill="#cbd5e1" name="Total Activities" radius={[4, 4, 0, 0]} />
        <Bar dataKey="completed" fill="#2563eb" name="Completed" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
