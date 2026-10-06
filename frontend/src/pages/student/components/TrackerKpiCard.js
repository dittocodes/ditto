import React from 'react';
import { Info, TrendingUp } from 'lucide-react';

const TONE_CLASS = {
  clock: 'tone-clock',
  book: 'tone-book',
  target: 'tone-target',
  medal: 'tone-medal',
};

function formatTrend(trendPct) {
  const n = Math.abs(Number(trendPct) || 0);
  if (trendPct >= 0) return `+${n}%`;
  return `-${n}%`;
}

export default function TrackerKpiCard({
  title,
  value,
  valueNumber,
  valueUnit,
  trendPct = 0,
  weeks = [],
  barHeights = [],
  icon: Icon,
  iconTone,
}) {
  const up = trendPct >= 0;
  const toneClass = TONE_CLASS[iconTone] || 'tone-clock';
  const displayNum = valueNumber != null && valueNumber !== '' ? valueNumber : value;
  const displayUnit = valueUnit || '';
  const heights = (barHeights?.length === 4 ? barHeights : weeks.slice(0, 4).map((_, i) => 18 + i * 4));

  return (
    <div className="tracker-kpi-card">
      <div className="tracker-kpi-top">
        <div className="tracker-kpi-title-row">
          {title}
          <Info size={13} strokeWidth={1.8} aria-hidden />
        </div>
        {Icon && (
          <span className={`tracker-kpi-icon-wrap ${toneClass}`}>
            <Icon size={22} strokeWidth={1.8} />
          </span>
        )}
      </div>
      <div className="tracker-kpi-value-large">
        {displayNum}
        {displayUnit ? <span>{displayUnit}</span> : null}
      </div>
      <div className={`tracker-kpi-change-line${up ? '' : ' down'}`}>
        <TrendingUp
          size={13}
          strokeWidth={2.3}
          className={!up ? 'tracker-trend-arrow-down' : undefined}
        />
        {formatTrend(trendPct)}
      </div>
      <div className="tracker-kpi-mini-bars">
        <div className="tracker-kpi-week-labels">
          <span>W1</span>
          <span>W2</span>
          <span>W3</span>
          <span>W4</span>
        </div>
        <div className="tracker-kpi-bar-row">
          {heights.map((h, i) => (
            <div key={i} className="tracker-kpi-bar" style={{ height: `${h}px` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
