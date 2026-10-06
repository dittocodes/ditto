import React from 'react';
import { TrendingUp } from 'lucide-react';

function InsightCard({ title, items }) {
  return (
    <div className="tracker-comparison-insight-card">
      <h3>{title}</h3>
      <div className="tracker-comparison-insight-list">
        {(items || []).map((item) => {
          const current = Math.min(100, Math.max(0, item.score || 0));
          const previous = Math.min(
            100,
            Math.max(
              0,
              item.previous_score ?? Math.round(current / (1 + (item.change_pct || 0) / 100)),
            ),
          );
          return (
          <div key={item.label} className="tracker-comparison-insight-row">
            <div className="tracker-comparison-insight-row-top">
              <span>{item.label}</span>
              <span className="tracker-comparison-insight-pct">
                <TrendingUp size={14} aria-hidden />
                +
                {item.change_pct}
                %
              </span>
            </div>
            <div className="tracker-comparison-insight-labels">
              <span>
                Previous:
                {previous}
                %
              </span>
              <span>
                Current:
                {current}
                %
              </span>
            </div>
            <div className="tracker-comparison-insight-bar">
              <div
                className="tracker-comparison-insight-bar-prev"
                style={{ width: `${previous}%` }}
              />
              <div
                className="tracker-comparison-insight-bar-curr"
                style={{ width: `${current}%` }}
              />
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function normalizeItems(items, labels) {
  if (items?.length) return items;
  return (labels || []).slice(0, 2).map((label) => ({
    label,
    change_pct: 12,
    score: 70,
    previous_score: 58,
  }));
}

export default function ComparisonInsightCards({ comparison }) {
  const improvements = normalizeItems(comparison?.improvement_items, comparison?.improvements);
  const focus = normalizeItems(comparison?.focus_items, comparison?.focus_areas);
  return (
    <div className="tracker-comparison-insight-grid">
      <InsightCard title="Biggest Improvements" items={improvements} />
      <InsightCard title="Areas Needing Focus" items={focus} />
    </div>
  );
}
