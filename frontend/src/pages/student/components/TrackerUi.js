import React from 'react';

export function TrackerPageHeader({ title, subtitle, actions }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
      <div>
        <h1 className="tracker-page-title">{title}</h1>
        {subtitle && <p className="tracker-page-sub">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function TrackerStatCard({ label, value, hint }) {
  return (
    <div className="tracker-card">
      <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      {hint && <div style={{ fontSize: 12, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function TrackerTabBar({ tabs, active, onChange }) {
  return (
    <div className="tracker-tabs">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          className={`tracker-tab${active === t ? ' active' : ''}`}
          onClick={() => onChange(t)}
        >
          {t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}
        </button>
      ))}
    </div>
  );
}
