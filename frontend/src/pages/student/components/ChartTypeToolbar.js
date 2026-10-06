import React from 'react';
import { BarChart3, LineChart, PieChart, Radar } from 'lucide-react';

export const CHART_TYPES = [
  { id: 'bar', label: 'Bar chart', icon: BarChart3 },
  { id: 'line', label: 'Line chart', icon: LineChart },
  { id: 'pie', label: 'Pie chart', icon: PieChart },
  { id: 'radar', label: 'Radar chart', icon: Radar },
];

export default function ChartTypeToolbar({ value, onChange, className = '' }) {
  return (
    <div className={`tracker-chart-type-toolbar ${className}`.trim()} role="group" aria-label="Chart type">
      {CHART_TYPES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={`tracker-chart-type-btn${value === id ? ' active' : ''}`}
          onClick={() => onChange(id)}
          title={label}
          aria-label={label}
          aria-pressed={value === id}
        >
          <Icon size={16} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
