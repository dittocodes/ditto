import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

function formatTrend(trendPct) {
  const n = Math.abs(Number(trendPct) || 0);
  if (trendPct >= 0) return `+${n}%`;
  return `-${n}%`;
}

export default function TrackerStatCard({
  title,
  value,
  trendPct = 0,
  progressPct = 0,
  lastUpdated,
  icon: Icon,
  detailLink,
  detailLabel = 'Show Details',
}) {
  const up = trendPct >= 0;
  const updatedLabel = lastUpdated?.startsWith('Last updated:')
    ? lastUpdated
    : (lastUpdated ? `Last updated: ${lastUpdated}` : '');

  return (
    <div className="tracker-stat-card tracker-stat-card-rich">
      <div className="tracker-stat-card-top">
        <span className="tracker-stat-card-title">{title}</span>
        {Icon && (
          <span className="tracker-stat-card-icon" aria-hidden>
            <Icon />
          </span>
        )}
      </div>
      <div className="tracker-stat-card-value">{value}</div>
      <div className={`tracker-stat-trend-pill${up ? ' up' : ' down'}`}>
        <span>{formatTrend(trendPct)}</span>
        <ArrowUpRight size={14} strokeWidth={2.2} className={!up ? 'tracker-trend-arrow-down' : ''} />
      </div>
      {updatedLabel && <div className="tracker-stat-updated">{updatedLabel}</div>}
      <div className="tracker-stat-progress-head">
        <span>Progress</span>
        <span>{Math.round(progressPct)}%</span>
      </div>
      <div className="tracker-stat-bar-row">
        <div className="tracker-stat-bar">
          <div className="tracker-stat-bar-fill" style={{ width: `${Math.min(100, progressPct)}%` }} />
        </div>
      </div>
      {detailLink && (
        <>
          <div className="tracker-stat-detail-divider" />
          <Link to={detailLink} className="tracker-stat-detail-btn">
            {detailLabel}
            {' '}
            →
          </Link>
        </>
      )}
    </div>
  );
}
