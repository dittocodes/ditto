import React from 'react';
import {
  BarChart3,
  Calendar,
  LineChart,
  PieChart,
  Radar,
} from 'lucide-react';

export const COMPARISON_CHART_TYPES = [
  { id: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { id: 'line', label: 'Line Chart', icon: LineChart },
  { id: 'pie', label: 'Pie Chart', icon: PieChart },
  { id: 'radar', label: 'Radar Chart', icon: Radar },
];

export const COMPARISON_RANGES = [
  { id: '1M', label: '1 Month' },
  { id: '3M', label: '3 Months' },
  { id: '6M', label: '6 Months' },
  { id: '1Y', label: '1 Year' },
];

export default function ComparisonSidebarControls({
  chartType,
  onChartTypeChange,
  range,
  onRangeChange,
}) {
  return (
    <aside className="tracker-comparison-sidebar">
      <div className="tracker-comparison-control-card">
        <div className="tracker-comparison-control-card-head">
          <h4>Select Visualization</h4>
          <PieChart size={18} className="tracker-comparison-control-card-icon" aria-hidden />
        </div>
        <div className="tracker-comparison-viz-grid">
          {COMPARISON_CHART_TYPES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`tracker-comparison-viz-btn${chartType === id ? ' active' : ''}`}
              onClick={() => onChartTypeChange(id)}
            >
              <Icon size={18} strokeWidth={2} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tracker-comparison-control-card">
        <div className="tracker-comparison-control-card-head">
          <h4>Time Range</h4>
          <Calendar size={18} className="tracker-comparison-control-card-icon" aria-hidden />
        </div>
        <div className="tracker-comparison-range-grid">
          {COMPARISON_RANGES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`tracker-comparison-range-btn${range === id ? ' active' : ''}`}
              onClick={() => onRangeChange(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
