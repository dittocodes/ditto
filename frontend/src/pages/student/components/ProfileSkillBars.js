import React from 'react';

export default function ProfileSkillBars({ items }) {
  return (
    <div>
      {(items || []).map((s) => (
        <div key={s.name} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span>{s.name}</span>
            <span>{s.pct ?? s.score}%</span>
          </div>
          <div className="tracker-stat-bar">
            <div className="tracker-stat-bar-fill" style={{ width: `${s.pct ?? (s.score / 5) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
